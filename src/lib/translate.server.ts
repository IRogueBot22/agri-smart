import { languageName } from "./languages";
import { generateJson } from "./ai-core.server";

/**
 * Server-side translation of short UI/notification strings into the
 * farmer's selected language. Falls back to English on any failure.
 */
export async function translateTexts(
  language: string,
  texts: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const unique = [...new Set(texts.filter(Boolean))];
  if (!language || language === "en" || !unique.length) {
    unique.forEach((t) => (out[t] = t));
    return out;
  }
  const target = languageName(language);
  try {
    const json = (await generateJson(
      `You are a professional localiser for an Indian farming mobile app.
Translate each English notification string into ${target} (${language}), using the native script.
Rules: keep it short and natural for a push notification; preserve numbers, units, placeholders and emoji exactly;
keep well-known product words (AI, GPS) as-is; do NOT add explanations.
Return ONLY JSON: {"translations": {"<english>": "<translated>", ...}} with every input string as a key.`,
      JSON.stringify({ strings: unique }),
    )) as { translations?: Record<string, string> };
    unique.forEach((t) => {
      const v = json.translations?.[t];
      out[t] = typeof v === "string" && v.trim() ? v.trim() : t;
    });
  } catch {
    unique.forEach((t) => (out[t] = t));
  }
  return out;
}
