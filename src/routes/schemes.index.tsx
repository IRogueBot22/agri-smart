import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listSchemes } from "@/lib/public.functions";
import { Landmark, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/schemes/")({
  head: () => ({ meta: [
    { title: "Government Schemes — AgriSmart AI" },
    { name: "description", content: "Explore Indian government schemes for farmers: PM-KISAN, PMFBY, KCC, and more." },
    { property: "og:title", content: "Government Schemes for Farmers" },
    { property: "og:description", content: "Discover benefits, eligibility, and application details." },
  ]}),
  component: Schemes,
});

function Schemes() {
  const load = useServerFn(listSchemes);
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  useEffect(() => { load().then(setRows); }, [load]);
  const cats = Array.from(new Set(rows.map((r) => r.category)));
  const filtered = rows.filter((r) =>
    (r.title + " " + r.description).toLowerCase().includes(q.toLowerCase()) &&
    (!cat || r.category === cat)
  );

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-10">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-sm">←</Link>
          <h1 className="text-base font-semibold">Government Schemes</h1>
        </div>
      </header>
      <div className="space-y-3 px-4 pt-4">
        <Input placeholder="Search schemes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCat("")} className={`rounded-full border px-3 py-1 text-xs ${!cat ? "bg-primary text-primary-foreground" : ""}`}>All</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "bg-primary text-primary-foreground" : ""}`}>{c}</button>
          ))}
        </div>
        {filtered.map((s) => (
          <Link key={s.id} to="/schemes/$id" params={{ id: s.id }}>
            <Card className="shadow-soft"><CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-2xl bg-primary/10 p-3"><Landmark className="h-5 w-5 text-primary" /></div>
              <div className="flex-1">
                <div className="text-xs text-primary">{s.category}</div>
                <div className="font-semibold">{s.title}</div>
                <div className="line-clamp-2 text-xs text-muted-foreground">{s.description}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
