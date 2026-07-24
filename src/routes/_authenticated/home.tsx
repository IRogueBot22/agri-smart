import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getWeather } from "@/lib/weather.functions";
import { Cloud, CloudRain, Droplets, Wind, Sprout, Bug, TrendingUp, Landmark, Leaf, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [
    { title: "Home — AgriSmart AI" },
    { name: "description", content: "Your farm dashboard: weather, AI advice, and quick actions." },
  ]}),
  component: Home,
});

function Home() {
  const [name, setName] = useState("Farmer");
  const [field, setField] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const fetchWeather = useServerFn(getWeather);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user!.id).maybeSingle();
      if (p?.full_name) setName(p.full_name.split(" ")[0]);
      const { data: fs } = await supabase.from("fields").select("*").order("created_at", { ascending: false }).limit(1);
      const f = fs?.[0]; if (f) setField(f);
      const lat = f?.centroid_lat ?? 17.385;
      const lng = f?.centroid_lng ?? 78.4867;
      try {
        const w = await fetchWeather({ data: { lat, lng } });
        setWeather(w);
      } catch (e) { console.error(e); }
    })();
  }, [fetchWeather]);

  const c = weather?.weather?.current;

  return (
    <AppShell>
      <div className="space-y-4 px-4 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Good day,</p>
          <h1 className="text-xl font-bold">{name} 👋</h1>
        </div>

        <Card className="overflow-hidden border-0 bg-gradient-primary text-primary-foreground shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs opacity-90">Today's weather</div>
                <div className="mt-1 text-4xl font-bold">{c ? `${Math.round(c.temperature_2m)}°C` : "—"}</div>
                <div className="text-xs opacity-90">{weather?.advisory ?? "Loading…"}</div>
              </div>
              {c && c.precipitation > 0 ? <CloudRain className="h-14 w-14 opacity-80" /> : <Sun className="h-14 w-14 opacity-80" />}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/15 p-2"><Droplets className="mx-auto h-4 w-4" /><div className="mt-1 font-semibold">{c?.relative_humidity_2m ?? "—"}%</div><div className="opacity-80">Humidity</div></div>
              <div className="rounded-xl bg-white/15 p-2"><Cloud className="mx-auto h-4 w-4" /><div className="mt-1 font-semibold">{weather?.weather?.daily?.precipitation_probability_max?.[0] ?? 0}%</div><div className="opacity-80">Rain</div></div>
              <div className="rounded-xl bg-white/15 p-2"><Wind className="mx-auto h-4 w-4" /><div className="mt-1 font-semibold">{c ? Math.round(c.wind_speed_10m) : "—"} km/h</div><div className="opacity-80">Wind</div></div>
            </div>
          </CardContent>
        </Card>

        {field ? (
          <Link to="/fields/$id" params={{ id: field.id }}>
            <Card className="shadow-soft"><CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">My farm</div>
                <div className="font-semibold">{field.name}</div>
                <div className="text-xs text-muted-foreground">{Number(field.area_acres).toFixed(2)} acres · {field.crop || "No crop set"} · {field.soil_type || "Soil not set"}</div>
              </div>
              <Leaf className="h-8 w-8 text-primary" />
            </CardContent></Card>
          </Link>
        ) : (
          <Link to="/fields/new">
            <Card className="border-dashed shadow-soft"><CardContent className="p-4 text-center text-sm text-muted-foreground">
              Draw your first field to get started →
            </CardContent></Card>
          </Link>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold">Quick actions</h2>
          <div className="grid grid-cols-3 gap-3">
            <QuickAction to="/fields" icon={Leaf} label="My Fields" />
            <QuickAction to="/weather" icon={Cloud} label="Weather" />
            <QuickAction to="/advisor" icon={Sprout} label="AI Advice" />
            <QuickAction to="/disease" icon={Bug} label="Leaf Scan" />
            <QuickAction to="/market" icon={TrendingUp} label="Market" />
            <QuickAction to="/schemes" icon={Landmark} label="Schemes" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="group">
      <Card className="border-0 shadow-soft transition-transform group-active:scale-95">
        <CardContent className="flex flex-col items-center gap-2 p-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
          <span className="text-xs font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
