import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3.6-flash";

function seasonFromMonth(m: number) {
  if ([6, 7, 8, 9].includes(m)) return "Kharif (monsoon)";
  if ([10, 11, 12, 1, 2].includes(m)) return "Rabi (winter)";
  return "Zaid (summer)";
}

async function fetchWeather(lat: number, lng: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`;
  const r = await fetch(url); if (!r.ok) return null; return await r.json();
}

async function loadField(supabase: any, userId: string, fieldId: string) {
  const { data, error } = await supabase.from("fields").select("*").eq("id", fieldId).eq("user_id", userId).single();
  if (error || !data) throw new Error("Field not found");
  return data;
}

async function callAI(prompt: string, system: string) {
  const key =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.LOVABLE_API_KEY ||
    process.env.VITE_AI_API_KEY;
  if (!key) throw new Error("Missing AI API Key (set AI_GATEWAY_API_KEY or OPENAI_API_KEY in environment)");
  const gateway = createAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    system,
    prompt,
  });
  // Try to extract JSON
  const match = text.match(/```json\s*([\s\S]+?)\s*```/) || text.match(/\{[\s\S]*\}/);
  const json = match ? JSON.parse(match[0].startsWith("```") ? match[1] : match[0]) : { raw: text };
  return json;
}

const FieldInput = z.object({ fieldId: z.string().uuid(), soil: z.string().optional(), water: z.string().optional() });

export const recommendCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    const field = await loadField(context.supabase, context.userId, data.fieldId);
    const w = await fetchWeather(field.centroid_lat, field.centroid_lng);
    const season = seasonFromMonth(new Date().getMonth() + 1);
    const soil = data.soil || field.soil_type || "Unknown";
    const water = data.water || field.water_source || "Unknown";

    const prompt = `Recommend the single best crop to plant now on this Indian farm.
Location: lat ${field.centroid_lat}, lng ${field.centroid_lng}
Area: ${field.area_acres} acres
Season: ${season}
Soil type: ${soil}
Water source / availability: ${water}
Weather (next 7 days): temps ${w?.daily?.temperature_2m_min?.[0]}-${w?.daily?.temperature_2m_max?.[0]}°C, rainfall sum next 7d: ${w?.daily?.precipitation_sum?.reduce((a: number, b: number) => a + b, 0).toFixed(1) ?? "N/A"} mm.

Respond ONLY with strict JSON:
{"crop":"<crop name>","confidence":<0-100>,"expected_profit_per_acre_inr":<number>,"reasons":["...","...","..."],"tips":["...","..."]}`;

    const out = await callAI(prompt, "You are an expert Indian agronomist. Output strict JSON only.");
    await context.supabase.from("recommendations").insert({ user_id: context.userId, field_id: data.fieldId, kind: "crop", payload: out });
    return out;
  });

export const recommendFertilizer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    const field = await loadField(context.supabase, context.userId, data.fieldId);
    const w = await fetchWeather(field.centroid_lat, field.centroid_lng);
    const prompt = `Recommend the best fertilizer plan.
Crop: ${field.crop || "not specified"}
Soil: ${data.soil || field.soil_type || "Unknown"}
Water source: ${data.water || field.water_source || "Unknown"}
Area: ${field.area_acres} acres
Weather next 7d rainfall (mm): ${w?.daily?.precipitation_sum?.reduce((a: number, b: number) => a + b, 0).toFixed(1) ?? "N/A"}

Respond ONLY with strict JSON:
{"fertilizer":"<name>","formula":"<eg 46% N>","dose_per_acre":"<eg 40 kg>","application_time":"<eg Basal at sowing>","method":"<eg Broadcasting>","estimated_cost_per_acre_inr":<number>,"notes":["..."]}`;
    const out = await callAI(prompt, "You are an Indian soil and fertilizer expert. JSON only.");
    await context.supabase.from("recommendations").insert({ user_id: context.userId, field_id: data.fieldId, kind: "fertilizer", payload: out });
    return out;
  });

export const recommendIrrigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    const field = await loadField(context.supabase, context.userId, data.fieldId);
    const w = await fetchWeather(field.centroid_lat, field.centroid_lng);
    const rainToday = w?.daily?.precipitation_sum?.[0] ?? 0;
    const rainTomorrow = w?.daily?.precipitation_sum?.[1] ?? 0;
    const humidity = w?.current?.relative_humidity_2m ?? 60;

    const prompt = `Recommend irrigation for today.
Crop: ${field.crop || "not specified"}
Area: ${field.area_acres} acres
Water source: ${data.water || field.water_source || "Unknown"}
Rain today (mm): ${rainToday}
Rain tomorrow (mm): ${rainTomorrow}
Humidity: ${humidity}%

Respond ONLY with strict JSON:
{"decision":"IRRIGATE"|"SKIP","reason":"...","water_amount_liters_per_acre":<number>,"best_time":"<eg early morning>","soil_moisture":"Low"|"Medium"|"High","confidence":<0-100>}`;
    const out = await callAI(prompt, "You are an irrigation expert. JSON only.");
    await context.supabase.from("recommendations").insert({ user_id: context.userId, field_id: data.fieldId, kind: "irrigation", payload: out });
    return out;
  });

export const predictYield = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    const field = await loadField(context.supabase, context.userId, data.fieldId);
    const prompt = `Predict yield and income for this farm.
Crop: ${field.crop || "not specified"}
Area: ${field.area_acres} acres
Soil: ${data.soil || field.soil_type || "Unknown"}
Water: ${data.water || field.water_source || "Unknown"}

Respond ONLY with strict JSON:
{"expected_yield_quintals_per_acre":<number>,"total_yield_quintals":<number>,"expected_income_inr":<number>,"expected_profit_inr":<number>,"confidence":<0-100>,"trend":[{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>}]}`;
    const out = await callAI(prompt, "You are an Indian agronomy analyst. JSON only.");
    await context.supabase.from("recommendations").insert({ user_id: context.userId, field_id: data.fieldId, kind: "yield", payload: out });
    return out;
  });

const DiseaseInput = z.object({
  imageDataUrl: z.string().startsWith("data:image/"),
  storagePath: z.string().optional(),
  fieldId: z.string().uuid().optional(),
});

export const detectDisease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DiseaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const key =
      process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.LOVABLE_API_KEY ||
      process.env.VITE_AI_API_KEY;
    if (!key) throw new Error("Missing AI API Key (set AI_GATEWAY_API_KEY or OPENAI_API_KEY in environment)");
    const gatewayUrl = process.env.AI_GATEWAY_URL || "https://ai.gateway.lovable.dev/v1/chat/completions";
    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: "You are a plant pathology expert trained on the PlantVillage disease dataset. Identify the disease on the leaf image, estimate a confidence score, and give farmer-friendly recommendations. Output strict JSON only." },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this leaf photo end-to-end and diagnose the plant disease.
Respond ONLY as strict JSON matching this exact shape:
{"disease":"<specific disease name or 'Healthy'>","crop":"<detected crop>","severity":"Low"|"Medium"|"High"|"None","confidence":<0-100 integer>,"description":"<1-2 sentence plain-English explanation of what you see>","recommendation":["<organic action>","<chemical action>","<preventive action>"],"chemicals":["<optional pesticide/fungicide name + dose>"]}` },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ],
        },
      ],
    };
    const res = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    const out = match ? JSON.parse(match[0]) : { disease: "Unknown", confidence: 0, description: text, recommendation: [] };

    await context.supabase.from("disease_scans").insert({
      user_id: context.userId,
      field_id: data.fieldId ?? null,
      image_url: data.storagePath ?? "inline",
      disease: out.disease,
      confidence: out.confidence,
      recommendation: (out.recommendation ?? []).join(" • "),
      raw: out,
    });
    return out;
  });

