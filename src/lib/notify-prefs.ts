// Shared (isomorphic) notification-preference logic used by the web alert
// hook and by the push API route. Pure functions only — no browser or
// server-only imports.

export type NotifyKind = "weather" | "advisory" | "disease" | "info";

export type NotifyPrefs = {
  notify_weather: boolean;
  notify_recommendations: boolean;
  notify_disease: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string; // "HH:MM"
  quiet_end: string; // "HH:MM"
};

export const DEFAULT_PREFS: NotifyPrefs = {
  notify_weather: true,
  notify_recommendations: true,
  notify_disease: true,
  quiet_hours_enabled: false,
  quiet_start: "22:00",
  quiet_end: "06:00",
};

export function normalizePrefs(row: Partial<NotifyPrefs> | null | undefined): NotifyPrefs {
  return {
    notify_weather: row?.notify_weather ?? DEFAULT_PREFS.notify_weather,
    notify_recommendations: row?.notify_recommendations ?? DEFAULT_PREFS.notify_recommendations,
    notify_disease: row?.notify_disease ?? DEFAULT_PREFS.notify_disease,
    quiet_hours_enabled: row?.quiet_hours_enabled ?? DEFAULT_PREFS.quiet_hours_enabled,
    quiet_start: row?.quiet_start ?? DEFAULT_PREFS.quiet_start,
    quiet_end: row?.quiet_end ?? DEFAULT_PREFS.quiet_end,
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
  return ((h % 24) * 60 + (m % 60) + 1440) % 1440;
}

/** Minutes since local midnight, optionally in a specific IANA timezone. */
export function minutesOfDay(date = new Date(), timeZone?: string): number {
  if (!timeZone) return date.getHours() * 60 + date.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

/** True when "now" falls inside the quiet window (handles overnight windows). */
export function isQuietNow(prefs: NotifyPrefs, now = new Date(), timeZone?: string): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  const start = toMinutes(prefs.quiet_start);
  const end = toMinutes(prefs.quiet_end);
  if (start === end) return false;
  const cur = minutesOfDay(now, timeZone);
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

export function isCategoryEnabled(prefs: NotifyPrefs, kind: NotifyKind): boolean {
  if (kind === "weather") return prefs.notify_weather;
  if (kind === "advisory") return prefs.notify_recommendations;
  if (kind === "disease") return prefs.notify_disease;
  return true; // generic/system messages are always allowed
}

/** Should this alert reach the farmer right now? */
export function shouldDeliver(
  prefs: NotifyPrefs,
  kind: NotifyKind,
  now = new Date(),
  timeZone?: string,
): { allowed: boolean; reason?: "category-off" | "quiet-hours" } {
  if (!isCategoryEnabled(prefs, kind)) return { allowed: false, reason: "category-off" };
  if (isQuietNow(prefs, now, timeZone)) return { allowed: false, reason: "quiet-hours" };
  return { allowed: true };
}
