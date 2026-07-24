import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getWeather } from "@/lib/weather.functions";
import { Cloud, CloudRain, Sun, Wind, Droplets } from "lucide-react";

export const Route = createFileRoute("/_authenticated/weather")({
  head: () => ({ meta: [
    { title: "Weather — AgriSmart AI" },
    { name: "description", content: "Live weather and 7-day forecast for your farm location." },
  ]}),
  component: WeatherView,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeatherView() {
  const [w, setW] = useState<any>(null);
  const fetchWeather = useServerFn(getWeather);
  useEffect(() => {
    (async () => {
      const { data: fs } = await supabase.from("fields").select("centroid_lat,centroid_lng").limit(1);
      const lat = fs?.[0]?.centroid_lat ?? 17.385, lng = fs?.[0]?.centroid_lng ?? 78.4867;
      setW(await fetchWeather({ data: { lat, lng } }));
    })();
  }, [fetchWeather]);

  const c = w?.weather?.current;
  const d = w?.weather?.daily;

  return (
    <AppShell title="Weather" back="/home">
      <div className="space-y-4 px-4 pt-4">
        <Card className="border-0 bg-gradient-primary text-primary-foreground shadow-soft"><CardContent className="p-5">
          <div className="text-xs opacity-90">Right now</div>
          <div className="mt-1 flex items-center justify-between">
            <div className="text-5xl font-bold">{c ? `${Math.round(c.temperature_2m)}°C` : "—"}</div>
            {c && c.precipitation > 0 ? <CloudRain className="h-16 w-16 opacity-90" /> : <Sun className="h-16 w-16 opacity-90" />}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <Stat icon={Droplets} label="Humidity" value={`${c?.relative_humidity_2m ?? "—"}%`} />
            <Stat icon={Cloud} label="Rain" value={`${d?.precipitation_sum?.[0]?.toFixed(1) ?? 0} mm`} />
            <Stat icon={Wind} label="Wind" value={`${c ? Math.round(c.wind_speed_10m) : "—"} km/h`} />
          </div>
        </CardContent></Card>

        <Card className="border-accent/50 bg-accent/10 shadow-soft">
          <CardContent className="p-4 text-sm"><b>Advisory:</b> {w?.advisory ?? "Loading…"}</CardContent>
        </Card>

        <div>
          <h2 className="mb-2 text-sm font-semibold">7-Day Forecast</h2>
          <Card className="shadow-soft"><CardContent className="divide-y p-0">
            {d?.time?.map((t: string, i: number) => {
              const day = new Date(t);
              return (
                <div key={t} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="w-14 font-medium">{i === 0 ? "Today" : DAYS[day.getDay()]}</div>
                  <div className="flex-1 text-center text-xs text-muted-foreground">{d.precipitation_probability_max[i]}% rain</div>
                  <div className="w-24 text-right">
                    <span className="font-semibold">{Math.round(d.temperature_2m_max[i])}°</span>
                    <span className="text-muted-foreground"> / {Math.round(d.temperature_2m_min[i])}°</span>
                  </div>
                </div>
              );
            })}
          </CardContent></Card>
        </div>
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
