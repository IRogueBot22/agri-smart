import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ lat: z.number(), lng: z.number() });

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lng}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,pressure_msl,cloud_cover,uv_index,is_day` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,relative_humidity_2m&forecast_days=7&past_days=0&timezone=auto`;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${data.lat}&longitude=${data.lng}&language=en&format=json`;

    const [wRes, gRes] = await Promise.all([fetch(url), fetch(geoUrl).catch(() => null)]);
    if (!wRes.ok) throw new Error("Weather service unavailable");
    const w = await wRes.json();
    let place: string | null = null;
    try {
      const g = gRes && gRes.ok ? await gRes.json() : null;
      const r = g?.results?.[0];
      if (r) place = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
    } catch {}

    const rainTomorrow = (w.daily?.precipitation_probability_max?.[1] ?? 0) as number;
    const rainToday = (w.daily?.precipitation_probability_max?.[0] ?? 0) as number;
    const temp = w.current?.temperature_2m ?? 25;
    const wind = w.current?.wind_speed_10m ?? 0;
    let advisory = "Conditions look normal.";
    if (rainTomorrow >= 60) advisory = "Rain expected tomorrow — skip irrigation today.";
    else if (rainToday >= 60) advisory = "Rain likely today — postpone spraying.";
    else if (temp > 35) advisory = "High heat — irrigate early morning or late evening.";
    else if (wind > 25) advisory = "Strong winds — avoid pesticide spraying today.";

    return { weather: w, advisory, place, fetchedAt: new Date().toISOString() };
  });
