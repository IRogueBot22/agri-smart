import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, CloudRain, Bug, Landmark, TrendingUp, Sprout } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [
    { title: "Notifications — AgriSmart AI" },
    { name: "description", content: "Weather alerts, disease warnings, schemes and market updates." },
  ]}),
  component: Notifications,
});

const ICONS: Record<string, any> = { weather: CloudRain, disease: Bug, scheme: Landmark, market: TrendingUp, harvest: Sprout };

const SAMPLE = [
  { kind: "weather", title: "Rain Alert", body: "Heavy rain expected tomorrow in your area.", created_at: new Date(Date.now() - 3600e3).toISOString() },
  { kind: "disease", title: "Disease Alert", body: "Leaf Spot detected in nearby fields.", created_at: new Date(Date.now() - 86400e3).toISOString() },
  { kind: "scheme", title: "Scheme Update", body: "PM-KISAN installment credited today.", created_at: new Date(Date.now() - 2 * 86400e3).toISOString() },
  { kind: "market", title: "Market Update", body: "Rice price increased 4% in your mandi.", created_at: new Date(Date.now() - 3 * 86400e3).toISOString() },
  { kind: "harvest", title: "Harvest Reminder", body: "Optimal harvest window opens in 5 days.", created_at: new Date(Date.now() - 4 * 86400e3).toISOString() },
];

function Notifications() {
  const [tab, setTab] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setRows(data && data.length ? data : SAMPLE);
    });
  }, []);
  const filtered = tab === "all" ? rows : rows.filter((r) => r.kind === tab);

  return (
    <AppShell title="Notifications">
      <div className="space-y-3 px-4 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4 text-xs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="weather">Weather</TabsTrigger>
            <TabsTrigger value="disease">Alerts</TabsTrigger>
            <TabsTrigger value="scheme">Schemes</TabsTrigger>
          </TabsList>
        </Tabs>
        {filtered.length === 0 && <p className="pt-8 text-center text-sm text-muted-foreground">No notifications yet.</p>}
        {filtered.map((n, i) => {
          const Icon = ICONS[n.kind] ?? Bell;
          return (
            <Card key={n.id ?? i} className="shadow-soft"><CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{n.title}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                </div>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </div>
            </CardContent></Card>
          );
        })}
      </div>
    </AppShell>
  );
}
