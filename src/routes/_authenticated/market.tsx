import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listMarketPrices } from "@/lib/public.functions";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProfileRegion } from "@/hooks/use-profile-region";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({ meta: [
    { title: "Market Prices — AgriSmart AI" },
    { name: "description", content: "Latest mandi prices for crops across India." },
  ]}),
  component: Market,
});

function fakeTrend(base: number) {
  return Array.from({ length: 7 }, (_, i) => ({ day: `D${i + 1}`, price: Math.round(base * (0.9 + Math.random() * 0.2)) }));
}

type Scope = "district" | "state" | "country" | "all";

function Market() {
  const { t } = useI18n();
  const list = useServerFn(listMarketPrices);
  const { region, loading } = useProfileRegion();
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("state");

  useEffect(() => {
    if (loading) return;
    const filters =
      scope === "all" ? {}
      : scope === "country" ? { country: region.country }
      : scope === "state" ? { country: region.country, state: region.state }
      : { country: region.country, state: region.state, district: region.district };
    list({ data: filters }).then(setRows).catch(() => setRows([]));
  }, [list, loading, scope, region.country, region.state, region.district]);

  const scopes: { key: Scope; label: string }[] = [
    { key: "district", label: region.district || t("My district") },
    { key: "state", label: region.state || t("My state") },
    { key: "country", label: region.country || t("My country") },
    { key: "all", label: t("All") },
  ];

  const filtered = rows.filter((r) => (r.crop + " " + r.market + " " + (r.state ?? "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell title={t("Market Prices")} back="/home">
      <div className="space-y-3 px-4 pt-4">
        <Input placeholder={t("Search crop or market…")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`rounded-full border px-3 py-1 text-xs ${scope === s.key ? "bg-primary text-primary-foreground" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {!loading && !region.state && (
          <p className="text-xs text-muted-foreground">{t("Set your country and region in Profile to see local prices.")}</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("No prices found for this region.")}</p>
        )}
        {filtered.map((r) => {
          const diff = r.prev_price ? Number(r.price_per_quintal) - Number(r.prev_price) : 0;
          const up = diff >= 0;
          const pct = r.prev_price ? ((diff / Number(r.prev_price)) * 100).toFixed(1) : "0";
          const trend = fakeTrend(Number(r.price_per_quintal));
          return (
            <Card key={r.id} className="shadow-soft"><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{r.crop}</div>
                  <div className="text-xs text-muted-foreground">{[r.market, r.district, r.state, r.country].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">₹{Number(r.price_per_quintal).toLocaleString("en-IN")}</div>
                  <div className={`flex items-center justify-end text-xs ${up ? "text-primary" : "text-destructive"}`}>
                    {up ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                    {up ? "+" : ""}{diff} ({pct}%)
                  </div>
                </div>
              </div>
              <div className="mt-2 h-16">
                <ResponsiveContainer><LineChart data={trend}>
                  <XAxis dataKey="day" hide /><YAxis hide domain={["auto", "auto"]} />
                  <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart></ResponsiveContainer>
              </div>
              <div className="text-xs text-muted-foreground">{t("per Quintal")}</div>
            </CardContent></Card>
          );
        })}
      </div>
    </AppShell>
  );
}
