import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";
import { classifyWithCnn, diagnoseLeaf } from "@/lib/leaf-diagnosis.server";
import { combineDiagnoses, rankDiagnoses } from "@/lib/rank-diagnoses";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Multipart leaf-scan endpoint for the Flutter app.
 *
 *   POST /api/public/ai/disease-scan   (Authorization: Bearer <supabase token>)
 *   form-data: file=<leaf photo> (repeatable, up to 5), crop?, fieldId?
 *
 * Flow: upload each photo to the private `leaf-scans` bucket as the caller ->
 *       Python TensorFlow CNN (`CNN_SERVICE_URL`) -> vision LLM enrichment ->
 *       rank + combine across photos -> persist to `disease_scans` ->
 *       return the combined verdict plus the ranked list and per-image results.
 */
export const Route = createFileRoute("/api/public/ai/disease-scan")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const caller = await authenticateRequest(request);
          if (!caller) return json({ error: "Unauthorized" }, 401);

          const form = await request.formData();
          const files = [...form.getAll("file"), ...form.getAll("files")].filter(
            (f): f is File => f instanceof File && f.size > 0,
          );
          if (!files.length) return json({ error: "Missing 'file' field" }, 400);
          if (files.length > MAX_FILES) {
            return json({ error: `Too many images (max ${MAX_FILES})` }, 413);
          }
          for (const f of files) {
            const mime = f.type || "image/jpeg";
            if (!ALLOWED.includes(mime)) {
              return json({ error: `Unsupported image type: ${mime}` }, 415);
            }
            if (f.size > MAX_BYTES) {
              return json({ error: "Image too large (max 8MB each)" }, 413);
            }
          }

          const cropRaw = form.get("crop");
          const crop =
            typeof cropRaw === "string" && cropRaw.trim()
              ? cropRaw.trim().slice(0, 80)
              : null;
          const fieldRaw = form.get("fieldId");
          const fieldId =
            typeof fieldRaw === "string" &&
            /^[0-9a-f-]{36}$/i.test(fieldRaw.trim())
              ? fieldRaw.trim()
              : null;

          const stamp = Date.now();
          const settled = await Promise.all(
            files.map(async (file, i) => {
              const mime = file.type || "image/jpeg";
              const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
              const storagePath = `${caller.userId}/${stamp}_${i}_scan.${ext}`;
              try {
                const bytes = await file.arrayBuffer();

                const { error: upErr } = await caller.supabase.storage
                  .from("leaf-scans")
                  .upload(storagePath, bytes, { contentType: mime, upsert: false });
                if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

                const { data: signed, error: signErr } = await caller.supabase.storage
                  .from("leaf-scans")
                  .createSignedUrl(storagePath, 60 * 60);
                if (signErr || !signed?.signedUrl) {
                  throw new Error("Could not create image URL");
                }

                const cnn = await classifyWithCnn(bytes, `scan.${ext}`, mime);
                const result = await diagnoseLeaf({
                  imageUrl: signed.signedUrl,
                  crop,
                  cnn,
                });
                return {
                  index: i,
                  ok: true as const,
                  storagePath,
                  imageUrl: signed.signedUrl,
                  ...result,
                };
              } catch (e: any) {
                return {
                  index: i,
                  ok: false as const,
                  storagePath,
                  error: e?.message ?? "Analysis failed",
                  status: e?.status ?? 502,
                };
              }
            }),
          );

          const good = settled.filter((r) => r.ok) as Extract<
            (typeof settled)[number],
            { ok: true }
          >[];
          if (!good.length) {
            const first = settled[0] as any;
            return json({ error: first?.error ?? "Scan failed" }, first?.status ?? 502);
          }

          const ranked = rankDiagnoses(good);
          const combined = combineDiagnoses(good)!;

          // One row per successfully analyzed photo; the top image carries the
          // combined verdict so history stays readable.
          const rows = good.map((r) => ({
            user_id: caller.userId,
            field_id: fieldId,
            image_url: r.storagePath,
            disease: r.disease,
            confidence: r.confidence,
            recommendation: (r.recommendation ?? []).join(" • ") || null,
            raw: { ...r, imageUrl: undefined, combined, ranked },
          }));
          const { data: inserted } = await caller.supabase
            .from("disease_scans")
            .insert(rows)
            .select("id");

          return json({
            // Combined verdict (also spread at top level for older clients).
            ...combined,
            id: inserted?.[0]?.id ?? null,
            ids: inserted?.map((r) => r.id) ?? [],
            imagesAnalyzed: good.length,
            imagesFailed: settled.length - good.length,
            storagePath: good[0].storagePath,
            imageUrl: good[0].imageUrl,
            combined,
            ranked,
            images: settled,
          });
        } catch (e: any) {
          console.error("[api/ai/disease-scan]", e?.message ?? e);
          return json({ error: e?.message ?? "Scan failed" }, 500);
        }
      },
    },
  },
});
