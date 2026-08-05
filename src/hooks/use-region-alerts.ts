// Scheme + market alerts, always scoped to the country/region saved in the
// farmer's profile (country → state → district). If the profile region
// changes, the dedupe window resets so the farmer immediately gets alerts
// for the new region and never keeps receiving alerts for the old one.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchPrefs, cachedPrefs } from "@/hooks/use-notify-prefs";
import { shouldDeliver } from "@/lib/notify-prefs";
import { translateNow } from "@/lib/i18n";
import { listSchemes, listMarketPrices } from "@/lib/public.functions";

type Alert = { code: string; kind: "scheme" | "market"; title: string; body: string };

const POLL_MS = 30 * 60 * 1000; // 30 minutes
const DEDUPE_KEY = "agri-region-alerts-sent";
const REGION_KEY = "agri-region-alerts-region";

type ProfileRegion = {
  country: string | null;
  state: string | null;
  district: string | null;
};

function regionId(r: ProfileRegion) {
  return [r.country ?? "", r.state ?? "", r.district ?? ""].join("|");
}

function loadSent(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DEDUPE_KEY) || "{}"); } catch { return {}; }
}
function saveSent(map: Record<string, number>) {
  try { localStorage.setItem(DEDUPE_KEY, JSON.stringify(map)); } catch {}
}

/** Wipe dedupe state whenever the saved profile region changes. */
function syncRegionScope(id: string) {
  try {
    if (localStorage.getItem(REGION_KEY) !== id) {
      localStorage.setItem(REGION_KEY, id);
      localStorage.removeItem(DEDUPE_KEY);
    }
  } catch {}
}

async function fetchRegion(): Promise<ProfileRegion | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("country, state, district")
    .eq("id", u.user.id)
    .maybeSingle();
  if (!data) return null;
  return { country: data.country ?? null, state: data.state ?? null, district: data.district ?? null };
}

function schemeAlerts(rows: any[], region: ProfileRegion): Alert[] {
  const where = region.state ? `${region.state}, ${region.country}` : (region.country ?? "your area");
  const cutoff = Date.now() - 14 * 86400e3;
  return rows
    .filter((s) => s.created_at && new Date(s.created_at).getTime() >= cutoff)
    .slice(0, 3)
    .map((s) => ({
      code: `scheme:${s.id}`,
      kind: "scheme" as const,
      title: `🏛 New scheme: ${s.title}`,
      body: `${s.benefits || s.description} — available for farmers in ${where}.`,
    }));
}

function marketAlerts(rows: any[], region: ProfileRegion): Alert[] {
  const alerts: Alert[] = [];
  for (const p of rows) {
    const prev = Number(p.prev_price ?? 0);
    const cur = Number(p.price_per_quintal ?? 0);
    if (!prev || !cur) continue;
    const pct = ((cur - prev) / prev) * 100;
    if (Math.abs(pct) < 5) continue;
    const dir = pct > 0 ? "rose" : "fell";
    alerts.push({
      code: `market:${p.id}:${p.recorded_on}`,
      kind: "market",
      title: `📈 ${p.crop} price ${dir} ${Math.abs(pct).toFixed(1)}%`,
      body: `${p.crop} is ₹${Math.round(cur)}/quintal at ${p.market}${p.district ? `, ${p.district}` : ""} (${p.state}).`,
    });
  }
  return alerts.slice(0, 3);
}

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
      user_id: u.user.id, kind: a.kind, title: a.title, body: a.body,
    });
  } catch {}
}

function notify(a: Alert) {
  toast(a.title, { description: a.body, duration: 8000 });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(a.title, { body: a.body, icon: "/favicon.ico", tag: a.code }); } catch {}
  }
}

export function useRegionAlerts() {
  const runningRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: any = null;

    async function check() {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const region = await fetchRegion();
        // No saved region → nothing to scope alerts to; stay silent.
        if (!region || !region.country) return;
        syncRegionScope(regionId(region));

        const prefs = await fetchPrefs().catch(() => cachedPrefs());
        if (!shouldDeliver(prefs, "advisory").allowed) return;

        const filter = { country: region.country, state: region.state, district: region.district };
        const [schemes, prices] = await Promise.all([
          listSchemes({ data: filter }).catch(() => []),
          listMarketPrices({ data: filter }).catch(() => []),
        ]);

        const alerts = [
          ...schemeAlerts(schemes as any[], region),
          ...marketAlerts(prices as any[], region),
        ];
        if (!alerts.length) return;

        const sent = loadSent();
        const now = Date.now();
        for (const a of alerts) {
          if (sent[a.code] && now - sent[a.code] < 24 * 3600 * 1000) continue;
          sent[a.code] = now;
          const localized = await localize(a);
          notify(localized);
          persist(localized);
        }
        for (const k of Object.keys(sent)) if (now - sent[k] > 7 * 86400e3) delete sent[k];
        saveSent(sent);
      } catch {} finally {
        runningRef.current = false;
      }
    }

    check();
    timer = setInterval(check, POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
