import { createServerFn } from "@tanstack/react-start";
import { generateJson } from "./ai-core.server";

type Level = "state" | "district" | "mandal" | "village";

type Input = {
  level: Level;
  country: string;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
};

const LABEL: Record<Level, string> = {
  state: "states / provinces",
  district: "districts",
  mandal: "mandals / blocks / talukas / sub-districts",
  village: "villages / gram panchayats",
};

/** Returns the administrative sub-regions for the selected parent area. */
export const listSubRegions = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => data)
  .handler(async ({ data }) => {
    const parent = [data.mandal, data.district, data.state, data.country].filter(Boolean).join(", ");
    if (!parent) return [] as string[];

    const json = await generateJson(
      "You are an authoritative gazetteer of administrative divisions. Reply with JSON only.",
      `List the ${LABEL[data.level]} inside "${parent}".
Return JSON: {"items": ["Name 1", "Name 2", ...]}
Rules:
- Use official English spellings, sorted alphabetically.
- For villages, list the most significant/populated ones (up to 80).
- For other levels, list ALL of them.
- If the area has no such division, return {"items": []}.`,
    );

    const items = Array.isArray((json as any).items) ? (json as any).items : [];
    return items
      .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s: string) => s.trim())
      .slice(0, 400);
  });
