import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchPrefs, cachedPrefs } from "@/hooks/use-notify-prefs";
import { shouldDeliver } from "@/lib/notify-prefs";
import { translateNow } from "@/lib/i18n";

type Severity = "low" | "medium" | "high";
type Alert = { code: string; title: string; body: string; severity: Severity };

const POLL_MS = 10 * 60 * 1000; // 10 minutes
const DEDUPE_KEY = "agri-alerts-sent";

function loadSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DEDUPE_KEY) || "{}"); } catch { return {}; }
}
function saveSent(map: Record<string, number>) {
  localStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
}

function evaluate(w: any): Alert[] {
  const alerts: Alert[] = [];
  const c = w?.current ?? {};
  const d = w?.daily ?? {};
  const wcodeToday = d?.weather_code?.[0];
  const wcodeTomorrow = d?.weather_code?.[1];
  const wind = c.wind_speed_10m ?? 0;
  const temp = c.temperature_2m ?? 20;
  const rainToday = d?.precipitation_sum?.[0] ?? 0;
  const popTomorrow = d?.precipitation_probability_max?.[1] ?? 0;

  // Thunderstorm codes 95-99
  if ([95, 96, 99].includes(wcodeToday)) {
    alerts.push({ code: "thunderstorm-today", severity: "high",
      title: "⛈ Thunderstorm warning",
      body: "Thunderstorms expected today. Secure equipment and avoid open fields." });
  }
  if ([95, 96, 99].includes(wcodeTomorrow)) {
    alerts.push({ code: "thunderstorm-tomorrow", severity: "high",
      title: "⛈ Thunderstorm tomorrow",
      body: "Thunderstorms forecast tomorrow. Postpone spraying and harvesting." });
  }
  if (wind >= 40) {
    alerts.push({ code: "high-wind", severity: "high",
      title: "🌪 High wind alert",
      body: `Wind at ${Math.round(wind)} km/h. Skip pesticide spraying and protect young crops.` });
  }
  if (rainToday >= 25) {
    alerts.push({ code: "heavy-rain-today", severity: "high",
      title: "🌧 Heavy rainfall today",
      body: `${rainToday.toFixed(1)} mm expected. Check drainage; skip irrigation.` });
  } else if (popTomorrow >= 80) {
    alerts.push({ code: "rain-tomorrow", severity: "medium",
      title: "🌦 Heavy rain likely tomorrow",
      body: `${popTomorrow}% chance of rain. Delay fertilizer application.` });
  }
  if (temp >= 40) {
    alerts.push({ code: "extreme-heat", severity: "high",
      title: "🔥 Extreme heat warning",
      body: `${Math.round(temp)}°C — irrigate before sunrise and shade sensitive crops.` });
  } else if (temp <= 5) {
    alerts.push({ code: "frost-risk", severity: "high",
      title: "❄ Frost risk",
      body: `${Math.round(temp)}°C — protect crops from cold damage tonight.` });
  }
  return alerts;
}

async function fetchWeather(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,wind_speed_10m,weather_code,precipitation` +
    `&daily=weather_code,precipitation_sum,precipitation_probability_max&forecast_days=2&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather fetch failed");
  return r.json();
}

/** Translate an alert into the farmer's selected language before showing/storing it. */
async function localize(a: Alert): Promise<Alert> {
  try {
    const m = await translateNow([a.title, a.body]);
    return { ...a, title: m[a.title] || a.title, body: m[a.body] || a.body };
  } catch {
    return a;
  }
}

async function persist(a: Alert) {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("notifications").insert({
      user_id: u.user.id, kind: "weather", title: a.title, body: a.body,
    });
  } catch {}
}

function notify(a: Alert) {
  toast(a.title, { description: a.body, duration: 8000 });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(a.title, { body: a.body, tag: a.code });
    } catch {}
  }
}

export function useSevereWeatherAlerts() {
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Request permission once (non-blocking, user-gesture-agnostic; browsers may defer)
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { Notification.requestPermission().catch(() => {}); } catch {}
    }

    async function check() {
      const c = coordsRef.current;
      if (!c) return;
      // Respect the farmer's category switches and quiet hours.
      const prefs = await fetchPrefs().catch(() => cachedPrefs());
      if (!shouldDeliver(prefs, "weather").allowed) return;
      try {
        const w = await fetchWeather(c.lat, c.lng);
        const alerts = evaluate(w);
        if (!alerts.length) return;
        const sent = loadSent();
        const now = Date.now();
        const dayKey = new Date().toISOString().slice(0, 10);
        for (const a of alerts) {
          const key = `${a.code}:${dayKey}`;
          if (sent[key] && now - sent[key] < 12 * 3600 * 1000) continue;
          sent[key] = now;
          const localized = await localize(a);
          notify(localized);
          persist(localized);
        }
        // prune old keys
        for (const k of Object.keys(sent)) if (now - sent[k] > 3 * 86400e3) delete sent[k];
        saveSent(sent);
      } catch {}
    }

    let watchId: number | null = null;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const prev = coordsRef.current;
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          coordsRef.current = next;
          // trigger immediate check on first fix or big movement (>2km)
          if (!prev || Math.hypot(prev.lat - next.lat, prev.lng - next.lng) > 0.02) check();
        },
        () => {},
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 },
      );
    }

    timerRef.current = setInterval(check, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
