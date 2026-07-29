// Shared (browser + server safe) weather helpers.

export function weatherUrl(lat: number, lng: number) {
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,pressure_msl,cloud_cover,uv_index,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max,wind_speed_10m_max` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,relative_humidity_2m&forecast_days=7&past_days=0&timezone=auto`
  );
}

export function geoUrl(lat: number, lng: number) {
  return `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lng}&language=en&format=json`;
}

export function buildAdvisory(w: any) {
  const rainTomorrow = (w?.daily?.precipitation_probability_max?.[1] ?? 0) as number;
  const rainToday = (w?.daily?.precipitation_probability_max?.[0] ?? 0) as number;
  const temp = w?.current?.temperature_2m ?? 25;
  const wind = w?.current?.wind_speed_10m ?? 0;
  if (rainTomorrow >= 60) return "Rain expected tomorrow — skip irrigation today.";
  if (rainToday >= 60) return "Rain likely today — postpone spraying.";
  if (temp > 35) return "High heat — irrigate early morning or late evening.";
  if (wind > 25) return "Strong winds — avoid pesticide spraying today.";
  return "Conditions look normal.";
}

export async function fetchJsonWithRetry(url: string, tries = 3, timeoutMs = 8000) {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } finally {
        clearTimeout(t);
      }
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error");
}

/** Runs entirely in the browser — used as a fallback when the server call fails. */
export async function fetchWeatherClient(lat: number, lng: number) {
  const w = await fetchJsonWithRetry(weatherUrl(lat, lng));
  let place: string | null = null;
  try {
    const g = await fetchJsonWithRetry(geoUrl(lat, lng), 1, 5000);
    const r = g?.results?.[0];
    if (r) place = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
  } catch {}
  return { weather: w, advisory: buildAdvisory(w), place, fetchedAt: new Date().toISOString() };
}
