import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { languageName } from "./languages";
import { generateJson } from "./ai-core.server";

const Input = z.object({
  language: z.string().min(2).max(10),
  texts: z.array(z.string().min(1).max(400)).min(1).max(120),
});

export const translateStrings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    if (data.language === "en") {
      return { translations: Object.fromEntries(data.texts.map((t) => [t, t])) as Record<string, string> };
    }
    const target = languageName(data.language);
    const json = (await generateJson(
      `You are a professional UI localiser for an Indian farming mobile app.
Translate each English UI string into ${target} (${data.language}), using the native script.
Rules: keep it short and natural for a mobile UI; preserve placeholders like {n}, %s, numbers, units and emoji exactly;
keep well-known product words (AI, GPS, PWA) as-is; do NOT add explanations.
Return ONLY JSON: {"translations": {"<english>": "<translated>", ...}} with every input string as a key.`,
      JSON.stringify({ strings: data.texts }),
    )) as { translations?: Record<string, string> };

    const out: Record<string, string> = {};
    for (const t of data.texts) {
      const v = json.translations?.[t];
      out[t] = typeof v === "string" && v.trim() ? v.trim() : t;
    }
    return { translations: out };
  });
