/**
 * Robust GPS acquisition for poor-signal conditions.
 *
 * Strategy:
 *  1. Run watchPosition in high-accuracy mode and keep the best fix seen.
 *  2. Resolve early once a fix meets `desiredAccuracy` (metres).
 *  3. On timeout, return the best fix so far (if any) instead of failing.
 *  4. Retry with backoff; the final attempt falls back to low-accuracy
 *     (network/cell positioning) which usually works indoors.
 */

export type GeoFix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

export type GeolocateOptions = {
  /** Stop early when accuracy is at least this good (metres). Default 50. */
  desiredAccuracy?: number;
  /** Per-attempt timeout in ms. Default 12000. */
  attemptTimeout?: number;
  /** Number of attempts. Default 3. */
  retries?: number;
  /** Accept a cached fix up to this age (ms). Default 30000. */
  maximumAge?: number;
  /** Progress callback: attempt number and best accuracy so far. */
  onProgress?: (info: { attempt: number; attempts: number; accuracy: number | null }) => void;
  signal?: AbortSignal;
};

function toFix(pos: GeolocationPosition): GeoFix {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? Number.POSITIVE_INFINITY,
    timestamp: pos.timestamp,
  };
}

function attemptOnce(opts: {
  highAccuracy: boolean;
  timeout: number;
  maximumAge: number;
  desiredAccuracy: number;
  onFix?: (fix: GeoFix) => void;
  signal?: AbortSignal;
}): Promise<GeoFix> {
  return new Promise<GeoFix>((resolve, reject) => {
    let best: GeoFix | null = null;
    let done = false;

    const finish = (err?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      opts.signal?.removeEventListener("abort", onAbort);
      if (best) resolve(best);
      else reject(err instanceof Error ? err : new Error("Location timed out"));
    };

    const onAbort = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      reject(new Error("Location cancelled"));
    };
    opts.signal?.addEventListener("abort", onAbort);

    const timer = setTimeout(() => finish(), opts.timeout);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = toFix(pos);
        if (!best || fix.accuracy < best.accuracy) {
          best = fix;
          opts.onFix?.(fix);
        }
        if (fix.accuracy <= opts.desiredAccuracy) finish();
      },
      (err) => {
        // PERMISSION_DENIED (1) is fatal; other errors let the timeout ride.
        if (err.code === 1) {
          best = null;
          finish(new Error(err.message || "Location permission denied"));
        }
      },
      {
        enableHighAccuracy: opts.highAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      },
    );
  });
}

export async function getAccuratePosition(options: GeolocateOptions = {}): Promise<GeoFix> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location is not supported on this device");
  }
  const desiredAccuracy = options.desiredAccuracy ?? 50;
  const attemptTimeout = options.attemptTimeout ?? 12000;
  const retries = Math.max(1, options.retries ?? 3);
  const maximumAge = options.maximumAge ?? 30000;

  let best: GeoFix | null = null;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (options.signal?.aborted) throw new Error("Location cancelled");
    options.onProgress?.({ attempt, attempts: retries, accuracy: best?.accuracy ?? null });
    const isLast = attempt === retries;
    try {
      const fix = await attemptOnce({
        // Final attempt falls back to coarse positioning for weak GPS signal.
        highAccuracy: !isLast || retries === 1,
        timeout: attemptTimeout,
        // Only allow a cached fix on the first attempt.
        maximumAge: attempt === 1 ? maximumAge : 0,
        desiredAccuracy,
        onFix: (f) => {
          if (!best || f.accuracy < best.accuracy) {
            best = f;
            options.onProgress?.({ attempt, attempts: retries, accuracy: f.accuracy });
          }
        },
        signal: options.signal,
      });
      if (!best || fix.accuracy < best.accuracy) best = fix;
      if (best.accuracy <= desiredAccuracy) return best;
    } catch (e) {
      lastErr = e;
      if (e instanceof Error && /denied|cancelled/i.test(e.message)) throw e;
    }
    // Short backoff before retrying.
    if (!isLast) await new Promise((r) => setTimeout(r, 800 * attempt));
  }

  if (best) return best;
  throw lastErr instanceof Error ? lastErr : new Error("Could not detect your location");
}
