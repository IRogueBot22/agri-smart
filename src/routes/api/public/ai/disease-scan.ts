import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";
import { classifyWithCnn, diagnoseLeaf } from "@/lib/leaf-diagnosis.server";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Multipart leaf-scan endpoint for the Flutter app.
 *
 *   POST /api/public/ai/disease-scan   (Authorization: Bearer <supabase token>)
 *   form-data: file=<leaf photo>, crop?=<string>, fieldId?=<uuid>
 *
 * Flow: upload to the private `leaf-scans` bucket as the caller ->
 *       Python TensorFlow CNN (`CNN_SERVICE_URL`) -> vision LLM enrichment ->
 *       persist to `disease_scans` -> return structured JSON.
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
          const file = form.get("file");
          if (!(file instanceof File)) {
            return json({ error: "Missing 'file' field" }, 400);
          }
          const mime = file.type || "image/jpeg";
          if (!ALLOWED.includes(mime)) {
            return json({ error: `Unsupported image type: ${mime}` }, 415);
          }
          const bytes = await file.arrayBuffer();
          if (bytes.byteLength === 0) return json({ error: "Empty file" }, 400);
          if (bytes.byteLength > MAX_BYTES) {
            return json({ error: "Image too large (max 8MB)" }, 413);
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

          const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
          const storagePath = `${caller.userId}/${Date.now()}_scan.${ext}`;

          const { error: upErr } = await caller.supabase.storage
            .from("leaf-scans")
            .upload(storagePath, bytes, { contentType: mime, upsert: false });
          if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

          const { data: signed, error: signErr } = await caller.supabase.storage
            .from("leaf-scans")
            .createSignedUrl(storagePath, 60 * 60);
          if (signErr || !signed?.signedUrl) {
            return json({ error: "Could not create image URL" }, 500);
          }

          const cnn = await classifyWithCnn(bytes, `scan.${ext}`, mime);

          let result;
          try {
            result = await diagnoseLeaf({ imageUrl: signed.signedUrl, crop, cnn });
          } catch (e: any) {
            return json({ error: e.message }, e.status ?? 502);
          }

          const { data: row } = await caller.supabase
            .from("disease_scans")
            .insert({
              user_id: caller.userId,
              field_id: fieldId,
              image_url: storagePath,
              disease: result.disease,
              confidence: result.confidence,
              recommendation: result.recommendation.join(" • ") || null,
            })
            .select("id")
            .single();

          return json({
            id: row?.id ?? null,
            ...result,
            storagePath,
            imageUrl: signed.signedUrl,
          });
        } catch (e: any) {
          console.error("[api/ai/disease-scan]", e?.message ?? e);
          return json({ error: e?.message ?? "Scan failed" }, 500);
        }
      },
    },
  },
});
