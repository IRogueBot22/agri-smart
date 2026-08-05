import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { History, Loader2, Trash2, Search, X, AlertTriangle, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ScanRow = {
  id: string;
  image_url: string;
  disease: string | null;
  confidence: number | null;
  recommendation: string | null;
  created_at: string;
  raw: any;
  signedUrl?: string | null;
};

const PAGE = 12;

type Verdict = "all" | "harmful" | "beneficial" | "mixed";
type Range = "all" | "7d" | "30d" | "90d";

const rangeDays: Record<Range, number | null> = { all: null, "7d": 7, "30d": 30, "90d": 90 };

export function ScanHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("all");
  const [range, setRange] = useState<Range>("all");

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query.trim()); setLimit(PAGE); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const filtersActive = debounced !== "" || verdict !== "all" || range !== "all";

  const load = useCallback(async (take: number, q: string, v: Verdict, r: Range) => {
    setLoading(true);
    let req = supabase
      .from("disease_scans")
      .select("id,image_url,disease,confidence,recommendation,created_at,raw")
      .order("created_at", { ascending: false })
      .limit(take + 1);

    if (q) req = req.or(`disease.ilike.%${q}%,recommendation.ilike.%${q}%`);

    const days = rangeDays[r];
    if (days) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      req = req.gte("created_at", since);
    }
    if (v !== "all") req = req.filter("raw->>verdict", "eq", v);

    const { data, error } = await req;
    if (error) {
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ScanRow[];
    setMore(list.length > take);
    const page = list.slice(0, take);

    const paths = page.map((x) => x.image_url).filter((p) => p && !p.startsWith("http"));
    let signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("leaf-scans")
        .createSignedUrls(paths, 60 * 60);
      signedMap = new Map((signed ?? []).map((s: any) => [s.path, s.signedUrl]));
    }
    setRows(page.map((x) => ({ ...x, signedUrl: signedMap.get(x.image_url) ?? (x.image_url?.startsWith("http") ? x.image_url : null) })));
    setLoading(false);
  }, []);

  useEffect(() => { load(limit, debounced, verdict, range); }, [load, limit, debounced, verdict, range, refreshKey]);

  const verdicts: { key: Verdict; label: string }[] = useMemo(() => ([
    { key: "all", label: "All" },
    { key: "harmful", label: "Harmful" },
    { key: "beneficial", label: "Beneficial" },
    { key: "mixed", label: "Mixed" },
  ]), []);

  const ranges: { key: Range; label: string }[] = useMemo(() => ([
    { key: "all", label: "Any time" },
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
  ]), []);

  function clearFilters() {
    setQuery(""); setDebounced(""); setVerdict("all"); setRange("all"); setLimit(PAGE);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("disease_scans").delete().eq("id", id);
    if (error) return toast.error("Could not delete scan");
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Scan removed");
  }

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">Previous scans</div>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {!loading && rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No scans yet — your diagnoses will appear here.</p>
        )}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3">
              <Link
                to="/scans/$id"
                params={{ id: r.id }}
                className="flex min-w-0 flex-1 items-start gap-3 rounded-xl transition-colors hover:bg-muted/50"
              >
                {r.signedUrl ? (
                  <img src={r.signedUrl} alt={r.disease ?? "Leaf scan"} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{r.disease ?? "Unknown"}</span>
                    {r.confidence != null && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {Math.round(Number(r.confidence))}%
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                  {r.recommendation && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.recommendation}</p>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label="Delete scan"
                className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>


        {more && (
          <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)} disabled={loading}>
            Load more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
