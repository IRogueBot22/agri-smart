import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { weatherUrl, geoUrl, buildAdvisory, fetchJsonWithRetry } from "./weather-core";

const Input = z.object({ lat: z.number(), lng: z.number() });

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    let w: any;
    try {
      w = await fetchJsonWithRetry(weatherUrl(data.lat, data.lng));
    } catch (e: any) {
      throw new Error(`Weather service unavailable (${e?.message ?? "network error"})`);
    }

    let place: string | null = null;
    try {
      const g = await fetchJsonWithRetry(geoUrl(data.lat, data.lng), 1, 5000);
      const r = g?.results?.[0];
      if (r) place = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
    } catch {}

    return { weather: w, advisory: buildAdvisory(w), place, fetchedAt: new Date().toISOString() };
  });
