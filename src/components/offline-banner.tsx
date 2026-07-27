import { useEffect, useState } from "react";

/** Tracks navigator.onLine and shows a subtle banner when offline. */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] mx-auto max-w-md bg-amber-500/95 px-4 py-2 text-center text-xs font-medium text-white shadow-soft">
      You're offline — showing cached data
    </div>
  );
}

/** Read/write JSON with a TTL to localStorage for offline fallback. */
export function cacheSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(`agri-cache:${key}`, JSON.stringify({ t: Date.now(), v: value }));
  } catch {}
}
export function cacheGet<T>(key: string, maxAgeMs = 24 * 3600 * 1000): T | null {
  try {
    const raw = localStorage.getItem(`agri-cache:${key}`);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > maxAgeMs) return v as T; // still return stale for offline use
    return v as T;
  } catch { return null; }
}
