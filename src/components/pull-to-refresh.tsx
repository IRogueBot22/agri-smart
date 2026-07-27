import { useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 120;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  function onTouchStart(e: React.TouchEvent) {
    if (refreshing) return;
    // Only start if page scrolled to top
    const scrollTop = document.scrollingElement?.scrollTop ?? window.scrollY;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!active.current || startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) { setPull(0); return; }
    // Rubber-band
    const eased = Math.min(MAX_PULL, dy * 0.5);
    setPull(eased);
  }

  async function onTouchEnd() {
    if (!active.current) return;
    active.current = false;
    startY.current = null;
    if (pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }

  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{ transform: `translateY(${pull}px)`, transition: active.current ? "none" : "transform 200ms ease-out" }}
    >
      <div
        className="pointer-events-none flex items-center justify-center"
        style={{ height: pull > 0 || refreshing ? THRESHOLD : 0, marginTop: -THRESHOLD, opacity: progress || (refreshing ? 1 : 0), transition: "height 150ms, opacity 150ms" }}
      >
        <div className="rounded-full bg-card p-2 shadow-soft">
          <RefreshCw
            className={"h-5 w-5 text-primary " + (refreshing ? "animate-spin" : "")}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
