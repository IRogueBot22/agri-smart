import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const AI_MODEL = "google/gemini-3.6-flash";

export function seasonFromMonth(m: number) {
  if ([6, 7, 8, 9].includes(m)) return "Kharif (monsoon)";
  if ([10, 11, 12, 1, 2].includes(m)) return "Rabi (winter)";
  return "Zaid (summer)";
}

export function requireApiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

export function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```json\s*([\s\S]+?)\s*```/);
  const bare = text.match(/\{[\s\S]*\}/);
  try {
    if (fenced) return JSON.parse(fenced[1]);
    if (bare) return JSON.parse(bare[0]);
  } catch {
    /* fall through */
  }
  return { raw: text };
}

export async function generateJson(system: string, prompt: string) {
  const gateway = createLovableAiGatewayProvider(requireApiKey());
  const { text } = await generateText({
    model: gateway(AI_MODEL),
    system,
    prompt,
  });
  return extractJson(text);
}

export async function generatePlainText(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const gateway = createLovableAiGatewayProvider(requireApiKey());
  const { text } = await generateText({
    model: gateway(AI_MODEL),
    system,
    messages,
  });
  return text;
}

export async function fetchWeatherSummary(lat: number, lng: number) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&forecast_days=7&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as any;
  } catch {
    return null;
  }
}

type Field = {
  id: string;
  name?: string | null;
  crop?: string | null;
  soil_type?: string | null;
  water_source?: string | null;
  area_acres: number;
  centroid_lat: number;
  centroid_lng: number;
};

export function buildAdvicePrompt(
  kind: "crop" | "fertilizer" | "irrigation" | "yield",
  field: Field,
  weather: any,
) {
  const rain7 =
    weather?.daily?.precipitation_sum
      ?.reduce((a: number, b: number) => a + (b ?? 0), 0)
      ?.toFixed(1) ?? "N/A";
  const base = `Farm details:
Name: ${field.name ?? "Field"}
Location: lat ${field.centroid_lat}, lng ${field.centroid_lng}
Area: ${field.area_acres} acres
Crop: ${field.crop || "not specified"}
Soil: ${field.soil_type || "Unknown"}
Water source: ${field.water_source || "Unknown"}
Season: ${seasonFromMonth(new Date().getMonth() + 1)}
Rainfall next 7 days: ${rain7} mm
Today's temperature: ${weather?.current?.temperature_2m ?? "N/A"}°C, humidity ${weather?.current?.relative_humidity_2m ?? "N/A"}%`;

  switch (kind) {
    case "crop":
      return `${base}

Recommend the single best crop to plant now on this Indian farm.
Respond ONLY with strict JSON:
{"crop":"<crop name>","confidence":<0-100>,"expected_profit_per_acre_inr":<number>,"reasons":["...","...","..."],"tips":["...","..."]}`;
    case "fertilizer":
      return `${base}

Recommend the best fertilizer plan.
Respond ONLY with strict JSON:
{"fertilizer":"<name>","formula":"<eg 46% N>","dose_per_acre":"<eg 40 kg>","application_time":"<eg Basal at sowing>","method":"<eg Broadcasting>","estimated_cost_per_acre_inr":<number>,"notes":["..."]}`;
    case "irrigation":
      return `${base}

Recommend irrigation for today.
Respond ONLY with strict JSON:
{"decision":"IRRIGATE","reason":"...","water_amount_liters_per_acre":<number>,"best_time":"<eg early morning>","soil_moisture":"Low","confidence":<0-100>}
("decision" must be IRRIGATE or SKIP; "soil_moisture" must be Low, Medium or High.)`;
    case "yield":
      return `${base}

Predict yield and income for this farm.
Respond ONLY with strict JSON:
{"expected_yield_quintals_per_acre":<number>,"total_yield_quintals":<number>,"expected_income_inr":<number>,"expected_profit_inr":<number>,"confidence":<0-100>,"trend":[{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>},{"year":<n>,"yield":<n>}]}`;
  }
}

export const ADVICE_SYSTEM: Record<string, string> = {
  crop: "You are an expert Indian agronomist. Output strict JSON only.",
  fertilizer: "You are an Indian soil and fertilizer expert. JSON only.",
  irrigation: "You are an irrigation expert. JSON only.",
  yield: "You are an Indian agronomy analyst. JSON only.",
};

/** Renders a JSON advice payload as farmer-friendly text for mobile clients. */
export function adviceToText(out: Record<string, any>): string {
  if (out.raw) return String(out.raw);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(out)) {
    if (v == null) continue;
    const label = k
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      if (typeof v[0] === "object") continue;
      lines.push(`${label}:`);
      v.forEach((item) => lines.push(`  • ${item}`));
    } else if (typeof v === "object") {
      continue;
    } else {
      lines.push(`${label}: ${v}`);
    }
  }
  return lines.join("\n");
}
