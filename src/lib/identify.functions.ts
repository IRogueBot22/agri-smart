import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { languageName } from "./languages";

const MODEL = "google/gemini-3.6-flash";

const IdentifyInput = z
  .object({
    imageDataUrl: z.string().startsWith("data:image/").optional(),
    imageDataUrls: z.array(z.string().startsWith("data:image/")).min(1).max(5).optional(),
    mode: z.enum(["weed", "plant", "seed"]),
    language: z.string().default("en"),
    storagePath: z.string().optional(),
    storagePaths: z.array(z.string()).optional(),
    fieldId: z.string().uuid().optional(),
  })
  .refine((d) => !!(d.imageDataUrl || d.imageDataUrls?.length), { message: "At least one image is required" });

const modePrompt = {
  weed: `Identify the WEED in this photo growing in/around an Indian farm field.
Decide clearly whether it is HARMFUL (invasive/competitive/toxic) or BENEFICIAL (edible, medicinal, fodder, green manure, pollinator-friendly) — many weeds are both, so explain.`,
  plant: `Identify the PLANT / CROP in this photo as grown in India. Cover what it is, how it is used and whether any part is harmful or toxic.`,
  seed: `Identify the SEED / GRAIN in this photo as used in Indian agriculture. Cover the crop it belongs to, sowing guidance, uses, and any toxicity or storage hazard.`,
} as const;

export const identifySpecimen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdentifyInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const lang = languageName(data.language);
    const images = data.imageDataUrls?.length ? data.imageDataUrls : [data.imageDataUrl!];
    const paths = data.storagePaths?.length ? data.storagePaths : data.storagePath ? [data.storagePath] : [];



    const body = {
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an Indian botanist, weed scientist and seed technologist. You identify weeds, plants and seeds from photographs and explain their uses and harms to smallholder farmers in plain words. Output strict JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${modePrompt[data.mode]}

You are given ${images.length} photo${images.length > 1 ? "s" : ""} of the SAME specimen taken from different angles or distances. Combine evidence from all photos into ONE single identification; if the photos disagree, prefer the clearest view and lower the confidence.

Write EVERY human-readable string value in ${lang} (keep the scientific/botanical name in Latin script). Keep sentences short and simple for a farmer.

Respond ONLY as strict JSON with this exact shape:
{"kind":"${data.mode}","name":"<common name>","local_names":["<Indian local names>"],"scientific_name":"<Latin binomial>","family":"<botanical family>","confidence":<0-100 integer>,
"verdict":"harmful"|"beneficial"|"mixed"|"neutral",
"harm_level":"None"|"Low"|"Medium"|"High",
"description":"<2-3 sentences on what you see and how to recognise it>",
"harms":["<how it harms crops, livestock or people>"],
"uses":["<medicinal, fodder, edible, soil, income or other uses>"],
"control":["<organic/manual control step>","<chemical or herbicide with dose>","<preventive step>"],
"safety":["<handling or toxicity warning>"],
"candidates":[{"name":"<alternative match>","confidence":<0-100>}]}`,
            },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up your workspace credits.");
    if (!res.ok) throw new Error(`AI error ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const j = await res.json();
    const text: string = j.choices?.[0]?.message?.content ?? "";
    const match = text.match(/```json\s*([\s\S]+?)\s*```/) || text.match(/\{[\s\S]*\}/);
    const out = match
      ? JSON.parse(match[0].startsWith("```") ? match[1]! : match[0])
      : { kind: data.mode, name: "Unknown", confidence: 0, description: text, uses: [], harms: [], control: [] };

    await context.supabase.from("disease_scans").insert({
      user_id: context.userId,
      field_id: data.fieldId ?? null,
      image_url: data.storagePath ?? "inline",
      disease: `${data.mode === "weed" ? "Weed" : data.mode === "seed" ? "Seed" : "Plant"}: ${out.name ?? "Unknown"}`,
      confidence: out.confidence ?? null,
      recommendation: [...(out.control ?? []), ...(out.uses ?? [])].join(" • "),
      raw: { ...out, mode: data.mode, language: data.language },
    });

    return out;
  });
