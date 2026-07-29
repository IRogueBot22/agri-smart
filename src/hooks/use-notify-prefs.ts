// Browser-side access to the farmer's notification preferences, with a
// localStorage cache so alerts still respect the settings while offline.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PREFS, normalizePrefs, type NotifyPrefs } from "@/lib/notify-prefs";

const CACHE_KEY = "agri-notify-prefs";

export function cachedPrefs(): NotifyPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS;
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(CACHE_KEY) || "null"));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function cachePrefs(p: NotifyPrefs) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch {}
}

export async function fetchPrefs(): Promise<NotifyPrefs> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return cachedPrefs();
    const { data } = await supabase
      .from("profiles")
      .select(
        "notify_weather, notify_recommendations, notify_disease, quiet_hours_enabled, quiet_start, quiet_end",
      )
      .eq("id", u.user.id)
      .single();
    const prefs = normalizePrefs(data as any);
    cachePrefs(prefs);
    return prefs;
  } catch {
    return cachedPrefs();
  }
}

export function useNotifyPrefs() {
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPrefs(cachedPrefs());
    fetchPrefs().then((p) => { setPrefs(p); setLoading(false); });
  }, []);

  const update = useCallback(async (patch: Partial<NotifyPrefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      cachePrefs(next);
      return next;
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("profiles").update(patch as any).eq("id", u.user.id);
  }, []);

  return { prefs, loading, update };
}
