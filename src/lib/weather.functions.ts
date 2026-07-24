import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ lat: z.number(), lng: z.number() });

export const getWeather = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${data.lat}&longitude=${data.lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&hourly=precipitation_probability&forecast_days=7&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather service unavailable");
    const w = await res.json();

    const rainTomorrow = (w.daily?.precipitation_probability_max?.[1] ?? 0) as number;
    const rainToday = (w.daily?.precipitation_probability_max?.[0] ?? 0) as number;
    let advisory = "Conditions look normal.";
    if (rainTomorrow >= 60) advisory = "Rain expected tomorrow — skip irrigation today.";
    else if (rainToday >= 60) advisory = "Rain likely today — postpone spraying.";
    else if ((w.current?.temperature_2m ?? 25) > 35) advisory = "High heat — irrigate early morning or late evening.";

    return { weather: w, advisory };
  });
