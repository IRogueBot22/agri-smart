import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWeather } from "@/lib/weather.functions";
import { fetchWeatherClient } from "@/lib/weather-core";
import {
  Cloud, CloudRain, Sun, Wind, Droplets, Gauge, Sunrise, Sunset,
  MapPin, RefreshCw, Thermometer, Eye, Compass,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/weather")({
  head: () => ({
    meta: [
      { title: "Live Weather — AgriSmart AI" },
      { name: "description", content: "Live weather, hourly + 7-day forecast for your farm location." },
    ],
  }),
  component: WeatherView,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function windDir(deg?: number) {
  if (deg == null) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function WeatherView() {
  const [w, setW] = useState<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; source: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchWeather = useServerFn(getWeather);
  const coordsRef = useRef<{ lat: number; lng: number; source: string } | null>(null);

  async function load(lat: number, lng: number, source: string, silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      let res: any;
      try {
        res = await fetchWeather({ data: { lat, lng } });
      } catch {
        // Fallback: fetch directly from the browser if the server call fails
        res = await fetchWeatherClient(lat, lng);
      }
      setW(res);
      const next = { lat, lng, source };
      coordsRef.current = next;
      setCoords(next);
    } catch (e: any) {
      if (!silent) setError(e?.message ?? "Failed to load weather");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function detectAndLoad(silent = false) {
    // Try browser geolocation first for truly live location
    const gpsPromise = new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
    const gps = await gpsPromise;
    if (gps) return load(gps.lat, gps.lng, "GPS", silent);

    const { data: fs } = await supabase.from("fields").select("centroid_lat,centroid_lng").limit(1);
    const lat = fs?.[0]?.centroid_lat ?? 17.385;
    const lng = fs?.[0]?.centroid_lng ?? 78.4867;
    load(lat, lng, fs?.[0] ? "Farm" : "Default", silent);
  }

  useEffect(() => {
    detectAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background job: silent refresh every 5 min (paused when tab hidden, resumes on focus/online)
  useAutoRefresh(() => {
    const c = coordsRef.current;
    if (c) return load(c.lat, c.lng, c.source, true);
    return detectAndLoad(true);
  }, 5 * 60 * 1000);

  const c = w?.weather?.current;
  const d = w?.weather?.daily;
  const h = w?.weather?.hourly;
  const nowIso = new Date().toISOString().slice(0, 13);
  const hourStart = h?.time?.findIndex?.((t: string) => t.slice(0, 13) >= nowIso);
  const hourly = h && hourStart >= 0
    ? h.time.slice(hourStart, hourStart + 24).map((t: string, i: number) => ({
        t,
        temp: h.temperature_2m[hourStart + i],
        pop: h.precipitation_probability[hourStart + i],
      }))
    : [];

  return (
    <AppShell title="Live Weather" back="/home">
      <div className="space-y-4 px-4 pt-4 pb-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span>
              {w?.place ?? (coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : "Locating…")}
              {coords ? ` · ${coords.source}` : ""}
            </span>
          </div>
          <Button
            variant="ghost" size="sm"
            className="h-7 gap-1 px-2"
            onClick={detectAndLoad}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card className="border-0 bg-gradient-primary text-primary-foreground shadow-soft">
          <CardContent className="p-5">
            <div className="text-xs opacity-90">
              Right now {w?.fetchedAt ? `· updated ${new Date(w.fetchedAt).toLocaleTimeString()}` : ""}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <div>
                <div className="text-5xl font-bold">{c ? `${Math.round(c.temperature_2m)}°C` : "—"}</div>
                <div className="text-xs opacity-90">
                  Feels like {c ? `${Math.round(c.apparent_temperature)}°` : "—"}
                </div>
              </div>
              {c && c.precipitation > 0
                ? <CloudRain className="h-16 w-16 opacity-90" />
                : (c?.is_day === 0 ? <Cloud className="h-16 w-16 opacity-90" /> : <Sun className="h-16 w-16 opacity-90" />)}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
              <Stat icon={Droplets} label="Humidity" value={`${c?.relative_humidity_2m ?? "—"}%`} />
              <Stat icon={CloudRain} label="Rain" value={`${d?.precipitation_sum?.[0]?.toFixed(1) ?? 0} mm`} />
              <Stat icon={Wind} label="Wind" value={`${c ? Math.round(c.wind_speed_10m) : "—"} km/h`} />
              <Stat icon={Compass} label="Dir" value={windDir(c?.wind_direction_10m) || "—"} />
              <Stat icon={Gauge} label="Pressure" value={`${c ? Math.round(c.pressure_msl) : "—"} hPa`} />
              <Stat icon={Eye} label="Cloud" value={`${c?.cloud_cover ?? "—"}%`} />
              <Stat icon={Thermometer} label="UV" value={`${c?.uv_index?.toFixed?.(1) ?? d?.uv_index_max?.[0]?.toFixed?.(1) ?? "—"}`} />
              <Stat icon={Sunrise} label="Sunrise" value={d?.sunrise?.[0]?.slice(11, 16) ?? "—"} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/50 bg-accent/10 shadow-soft">
          <CardContent className="p-4 text-sm">
            <b>Farm advisory:</b> {w?.advisory ?? "Loading…"}
          </CardContent>
        </Card>

        {hourly.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold">Next 24 hours</h2>
            <Card className="shadow-soft">
              <CardContent className="p-0">
                <div className="flex gap-3 overflow-x-auto px-4 py-3">
                  {hourly.map((row: any) => {
                    const dt = new Date(row.t);
                    return (
                      <div key={row.t} className="flex min-w-[52px] flex-col items-center gap-1 text-xs">
                        <div className="text-muted-foreground">{dt.getHours()}:00</div>
                        <div className="font-semibold">{Math.round(row.temp)}°</div>
                        <div className="flex items-center gap-0.5 text-primary">
                          <Droplets className="h-3 w-3" />
                          {row.pop ?? 0}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">7-Day Forecast</h2>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <Sunrise className="h-3 w-3" /> {d?.sunrise?.[0]?.slice(11, 16) ?? "—"}
              <Sunset className="h-3 w-3" /> {d?.sunset?.[0]?.slice(11, 16) ?? "—"}
            </div>
          </div>
          <Card className="shadow-soft">
            <CardContent className="divide-y p-0">
              {d?.time?.map((t: string, i: number) => {
                const day = new Date(t);
                return (
                  <div key={t} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="w-14 font-medium">{i === 0 ? "Today" : DAYS[day.getDay()]}</div>
                    <div className="flex-1 text-center text-xs text-muted-foreground">
                      {d.precipitation_probability_max[i]}% · {d.precipitation_sum[i]?.toFixed(1) ?? 0} mm
                    </div>
                    <div className="w-24 text-right">
                      <span className="font-semibold">{Math.round(d.temperature_2m_max[i])}°</span>
                      <span className="text-muted-foreground"> / {Math.round(d.temperature_2m_min[i])}°</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <p className="pt-2 text-center text-[10px] text-muted-foreground">
          Live data from Open-Meteo · auto-refresh every 5 min
        </p>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-2 text-center">
      <Icon className="mx-auto h-4 w-4" />
      <div className="mt-1 font-semibold">{value}</div>
      <div className="opacity-80">{label}</div>
    </div>
  );
}
