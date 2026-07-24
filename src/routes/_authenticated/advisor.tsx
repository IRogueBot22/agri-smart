import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recommendCrop, recommendFertilizer, recommendIrrigation, predictYield } from "@/lib/advisor.functions";
import { toast } from "sonner";
import { Sparkles, Droplet, Beaker, TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/advisor")({
  validateSearch: z.object({ field: z.string().optional() }).parse,
  head: () => ({ meta: [
    { title: "AI Advisor — AgriSmart AI" },
    { name: "description", content: "AI-powered crop, fertilizer, irrigation, and yield advice for your farm." },
  ]}),
  component: Advisor,
});

const SOILS = ["Black Soil", "Red Soil", "Sandy Soil", "Loamy Soil", "Alluvial", "Clay"];
const WATER = ["Borewell", "Canal", "Rainfed", "River", "Pond", "Drip Irrigation"];

function Advisor() {
  const { field: preselect } = Route.useSearch();
  const [fields, setFields] = useState<any[]>([]);
  const [fieldId, setFieldId] = useState<string>(preselect ?? "");
  const [soil, setSoil] = useState(""); const [water, setWater] = useState("");
  const [tab, setTab] = useState("crop");
  const [result, setResult] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const crop = useServerFn(recommendCrop);
  const fert = useServerFn(recommendFertilizer);
  const irr = useServerFn(recommendIrrigation);
  const yld = useServerFn(predictYield);

  useEffect(() => {
    supabase.from("fields").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setFields(data ?? []);
      if (!fieldId && data && data.length) setFieldId(data[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(kind: string) {
    if (!fieldId) return toast.error("Pick a field first");
    setLoading(kind);
    try {
      const fn = kind === "crop" ? crop : kind === "fertilizer" ? fert : kind === "irrigation" ? irr : yld;
      const r = await fn({ data: { fieldId, soil: soil || undefined, water: water || undefined } });
      setResult((x) => ({ ...x, [kind]: r }));
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    setLoading(null);
  }

  if (!fields.length) return (
    <AppShell title="AI Advisor">
      <div className="px-4 pt-8 text-center text-sm text-muted-foreground">
        <p>Draw a field first to get AI advice.</p>
        <Link to="/fields/new"><Button className="mt-4 bg-gradient-primary">Draw a field</Button></Link>
      </div>
    </AppShell>
  );

  return (
    <AppShell title="AI Advisor" back="/home">
      <div className="space-y-3 px-4 pt-4">
        <Card className="shadow-soft"><CardContent className="space-y-2 p-3 text-sm">
          <div>
            <label className="text-xs text-muted-foreground">Field</label>
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {fields.map((f) => <option key={f.id} value={f.id}>{f.name} ({Number(f.area_acres).toFixed(2)} ac)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Soil (override)</label>
              <select value={soil} onChange={(e) => setSoil(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Use field's soil</option>{SOILS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Water (override)</label>
              <select value={water} onChange={(e) => setWater(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Use field's source</option>{WATER.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Season and weather are detected automatically from your field location.</p>
        </CardContent></Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="crop"><Sparkles className="mr-1 h-4 w-4" />Crop</TabsTrigger>
            <TabsTrigger value="fertilizer"><Beaker className="mr-1 h-4 w-4" />Fert.</TabsTrigger>
            <TabsTrigger value="irrigation"><Droplet className="mr-1 h-4 w-4" />Water</TabsTrigger>
            <TabsTrigger value="yield"><TrendingUp className="mr-1 h-4 w-4" />Yield</TabsTrigger>
          </TabsList>

          <TabsContent value="crop"><Section title="Crop Recommendation" onRun={() => run("crop")} loading={loading === "crop"} data={result.crop} render={renderCrop} /></TabsContent>
          <TabsContent value="fertilizer"><Section title="Fertilizer Recommendation" onRun={() => run("fertilizer")} loading={loading === "fertilizer"} data={result.fertilizer} render={renderFert} /></TabsContent>
          <TabsContent value="irrigation"><Section title="Irrigation Advisory" onRun={() => run("irrigation")} loading={loading === "irrigation"} data={result.irrigation} render={renderIrr} /></TabsContent>
          <TabsContent value="yield"><Section title="Yield Prediction" onRun={() => run("yield")} loading={loading === "yield"} data={result.yield} render={renderYield} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Section({ title, onRun, loading, data, render }: any) {
  return (
    <div className="mt-3 space-y-3">
      <Button disabled={loading} onClick={onRun} className="w-full bg-gradient-primary shadow-soft">{loading ? "Analyzing…" : `Get ${title}`}</Button>
      {data && <Card className="shadow-soft"><CardContent className="p-4 text-sm">{render(data)}</CardContent></Card>}
    </div>
  );
}

function renderCrop(d: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div><div className="text-xs text-muted-foreground">Recommended crop</div><div className="text-2xl font-bold text-primary">{d.crop}</div></div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{d.confidence}% confidence</div>
      </div>
      <div className="text-sm">Expected profit: <b>₹{Number(d.expected_profit_per_acre_inr ?? 0).toLocaleString("en-IN")}/acre</b></div>
      {d.reasons && <ul className="mt-2 space-y-1 text-sm">{d.reasons.map((r: string, i: number) => <li key={i}>✓ {r}</li>)}</ul>}
      {d.tips && <div className="mt-2 rounded-xl bg-accent/10 p-2 text-xs"><b>Tips:</b> {d.tips.join(" · ")}</div>}
    </div>
  );
}
function renderFert(d: any) {
  return (
    <div className="space-y-2">
      <div className="text-2xl font-bold text-primary">{d.fertilizer} <span className="text-sm font-normal text-muted-foreground">({d.formula})</span></div>
      <Grid rows={[["Dose", d.dose_per_acre], ["Application", d.application_time], ["Method", d.method], ["Est. cost", `₹${Number(d.estimated_cost_per_acre_inr ?? 0).toLocaleString("en-IN")}/acre`]]} />
      {d.notes && <div className="mt-2 rounded-xl bg-accent/10 p-2 text-xs">{d.notes.join(" · ")}</div>}
    </div>
  );
}
function renderIrr(d: any) {
  const skip = d.decision === "SKIP";
  return (
    <div className="space-y-2">
      <div className={`text-2xl font-bold ${skip ? "text-primary" : "text-accent-foreground"}`}>{skip ? "Skip Irrigation Today" : "Irrigate Today"}</div>
      <p className="text-sm">{d.reason}</p>
      <Grid rows={[["Amount", `${d.water_amount_liters_per_acre ?? 0} L/acre`], ["Best time", d.best_time], ["Soil moisture", d.soil_moisture], ["Confidence", `${d.confidence}%`]]} />
    </div>
  );
}
function renderYield(d: any) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat title="Expected yield" value={`${d.expected_yield_quintals_per_acre} qtl/ac`} />
        <Stat title="Total yield" value={`${d.total_yield_quintals} qtl`} />
        <Stat title="Expected income" value={`₹${Number(d.expected_income_inr ?? 0).toLocaleString("en-IN")}`} />
        <Stat title="Expected profit" value={`₹${Number(d.expected_profit_inr ?? 0).toLocaleString("en-IN")}`} />
      </div>
      {d.trend && (
        <div className="h-40">
          <ResponsiveContainer><LineChart data={d.trend}>
            <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="yield" stroke="var(--primary)" strokeWidth={2} dot />
          </LineChart></ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Grid({ rows }: { rows: [string, any][] }) {
  return <div className="grid grid-cols-2 gap-2">{rows.map(([k, v]) => <div key={k} className="rounded-xl bg-muted/50 p-2 text-xs"><div className="text-muted-foreground">{k}</div><div className="font-semibold">{v}</div></div>)}</div>;
}
function Stat({ title, value }: any) { return <div className="rounded-xl bg-primary/5 p-2"><div className="text-xs text-muted-foreground">{title}</div><div className="font-semibold">{value}</div></div>; }
