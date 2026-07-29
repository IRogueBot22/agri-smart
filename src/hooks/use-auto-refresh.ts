import { useEffect, useRef } from "react";

/**
 * Background job runner: calls `fn` on an interval, pauses while the tab is
 * hidden (running immediately when it becomes visible again) and re-runs when
 * the network comes back online.
 */
export function useAutoRefresh(fn: () => void | Promise<void>, intervalMs = 5 * 60 * 1000) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastRun = Date.now();

    const run = () => {
      lastRun = Date.now();
      void fnRef.current();
    };

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return; // pause in background
      run();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun >= intervalMs) run();
    };
    const onOnline = () => run();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [intervalMs]);
}
