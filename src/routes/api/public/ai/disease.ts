import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";
import { AI_MODEL, extractJson, requireApiKey } from "@/lib/ai-core.server";

const Body = z.object({
  imageUrl: z.string().url().max(4000),
  crop: z.string().max(80).nullish(),
  fieldId: z.string().uuid().nullish(),
  storagePath: z.string().max(500).nullish(),
});

const SYSTEM =
  "You are a plant pathology expert trained on the PlantVillage disease dataset. " +
  "Identify the disease on the leaf image, estimate a confidence score, and give " +
  "farmer-friendly recommendations. Output strict JSON only.";

export const Route = createFileRoute("/api/public/ai/disease")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const caller = await authenticateRequest(request);
          if (!caller) return json({ error: "Unauthorized" }, 401);

          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) {
            return json({ error: "Invalid request body" }, 400);
          }
          const { imageUrl, crop, fieldId, storagePath } = parsed.data;

          const gatewayUrl = process.env.AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
          const apiKey = requireApiKey();
          const res = await fetch(
            gatewayUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Lovable-API-Key": apiKey,
              },
              body: JSON.stringify({
                model: AI_MODEL,
                messages: [
                  { role: "system", content: SYSTEM },
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: `Analyze this leaf photo and diagnose the plant disease.${
                          crop ? ` The farmer says the crop is ${crop}.` : ""
                        }
Respond ONLY as strict JSON matching this exact shape:
{"disease":"<specific disease name or 'Healthy'>","crop":"<detected crop>","severity":"Low","confidence":<0-100 integer>,"description":"<1-2 sentence plain-English explanation>","recommendation":["<organic action>","<chemical action>","<preventive action>"],"chemicals":["<pesticide/fungicide name + dose>"]}
("severity" must be None, Low, Medium or High.)`,
                      },
                      { type: "image_url", image_url: { url: imageUrl } },
                    ],
                  },
                ],
              }),
            },
          );

          if (!res.ok) {
            const body = await res.text();
            console.error(`[api/ai/disease] gateway ${res.status}: ${body}`);
            return json(
              { error: `AI provider error [${res.status}]: ${body.slice(0, 300)}` },
              res.status === 429 || res.status === 402 ? res.status : 502,
            );
          }

          const j = await res.json();
          const out = extractJson(j.choices?.[0]?.message?.content ?? "") as any;

          await caller.supabase.from("disease_scans").insert({
            user_id: caller.userId,
            field_id: fieldId ?? null,
            image_url: storagePath ?? imageUrl,
            disease: out.disease ?? null,
            confidence: typeof out.confidence === "number" ? out.confidence : null,
            recommendation: Array.isArray(out.recommendation)
              ? out.recommendation.join(" • ")
              : (out.recommendation ?? null),
          });

          return json({
            ...out,
            recommendation: Array.isArray(out.recommendation)
              ? out.recommendation.join("\n• ")
              : out.recommendation,
          });
        } catch (e: any) {
          console.error("[api/ai/disease]", e?.message ?? e);
          return json({ error: e?.message ?? "Diagnosis failed" }, 500);
        }
      },
    },
  },
});
