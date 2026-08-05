import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scans/$id")({
  head: () => ({
    meta: [
      { title: "Scan Details — AgriSmart AI" },
      { name: "description", content: "Full leaf image, all AI model outputs and the exact confidence breakdown for a previous disease scan." },
      { property: "og:title", content: "Scan Details — AgriSmart AI" },
      { property: "og:description", content: "Full leaf image, all AI model outputs and the exact confidence breakdown for a previous disease scan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScanDetail,
});

type Row = {
  id: string;
  image_url: string;
  disease: string | null;
  confidence: number | null;
  recommendation: string | null;
  created_at: string;
  field_id: string | null;
  raw: any;
};

function pct(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-gradient-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function ScanDetail() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const [row, setRow] = useState<Row | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("disease_scans")
        .select("id,image_url,disease,confidence,recommendation,created_at,field_id,raw")
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      const r = data as unknown as Row;
      setRow(r);
      if (r.image_url?.startsWith("http")) setImg(r.image_url);
      else if (r.image_url && r.image_url !== "inline") {
        const { data: signed } = await supabase.storage
          .from("leaf-scans")
          .createSignedUrl(r.image_url, 60 * 60);
        if (alive) setImg(signed?.signedUrl ?? null);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function remove() {
    const { error } = await supabase.from("disease_scans").delete().eq("id", id);
    if (error) return toast.error(t("Could not delete scan"));
    toast.success(t("Scan removed"));
    window.history.back();
  }

  const raw = row?.raw ?? {};
  const combined = raw.combined ?? null;
  const ranked: any[] = Array.isArray(raw.ranked) ? raw.ranked : [];
  const recs: string[] = Array.isArray(raw.recommendation)
    ? raw.recommendation
    : row?.recommendation
      ? row.recommendation.split(" • ").filter(Boolean)
      : [];
  const chemicals: string[] = Array.isArray(raw.chemicals) ? raw.chemicals : [];
  const conf = pct(row?.confidence) ?? 0;
  const cnnConf = pct(raw.cnn?.confidence ?? raw.cnnConfidence);
  const llmConf = pct(raw.llmConfidence ?? (raw.source === "llm" ? raw.confidence : null));

  return (
    <AppShell title={t("Scan Details")} back="/disease">
      <div className="space-y-4 px-4 pt-4 pb-8">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && !row && (
          <Card className="shadow-soft">
            <CardContent className="space-y-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("This scan no longer exists.")}</p>
              <Button asChild variant="outline">
                <Link to="/disease">{t("Back to Disease Detection")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {row && (
          <>
            <Card className="overflow-hidden shadow-soft">
              {img ? (
                <img src={img} alt={row.disease ?? "Leaf scan"} className="max-h-[60vh] w-full bg-muted object-contain" />
              ) : (
                <div className="flex h-52 items-center justify-center bg-muted text-xs text-muted-foreground">
                  {t("Image unavailable")}
                </div>
              )}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(row.created_at), "d MMM yyyy, h:mm a")}
                      {raw.crop ? ` · ${raw.crop}` : ""}
                    </div>
                    <h1 className="text-2xl font-bold leading-tight text-primary">{row.disease ?? t("Unknown")}</h1>
                    {raw.severity && (
                      <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {t("Severity")}: {raw.severity}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={remove}
                    aria-label={t("Delete scan")}
                    className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Bar value={conf} />
                  <span className="shrink-0 text-sm font-semibold text-primary">{conf}%</span>
                </div>
                {raw.description && <p className="text-sm">{raw.description}</p>}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="space-y-3 p-4">
                <div className="text-sm font-semibold">{t("Confidence breakdown")}</div>
                <div className="space-y-2 text-sm">
                  <Metric label={t("Final confidence")} value={conf} />
                  {cnnConf != null && <Metric label={t("TensorFlow CNN")} value={cnnConf} />}
                  {llmConf != null && <Metric label={t("Vision model")} value={llmConf} />}
                  {combined && (
                    <>
                      <Metric label={t("Combined score")} value={pct(combined.score) ?? 0} />
                      <Metric label={t("Photo agreement")} value={pct(combined.agreement) ?? 0} />
                    </>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
                  {raw.source && <Fact k={t("Model source")} v={String(raw.source)} />}
                  {raw.cnn?.label && <Fact k={t("CNN label")} v={String(raw.cnn.label)} />}
                  {combined?.votes != null && <Fact k={t("Votes")} v={`${combined.votes} ${t("of")} ${combined.imagesAnalyzed ?? "?"} ${t("photos")}`} />}
                  {combined?.peakConfidence != null && <Fact k={t("Peak confidence")} v={`${pct(combined.peakConfidence)}%`} />}
                  {combined?.avgConfidence != null && <Fact k={t("Average confidence")} v={`${pct(combined.avgConfidence)}%`} />}
                  {combined?.conflicting != null && <Fact k={t("Photos disagreed")} v={combined.conflicting ? t("Yes") : t("No")} />}
                </dl>
              </CardContent>
            </Card>

            {ranked.length > 1 && (
              <Card className="shadow-soft">
                <CardContent className="space-y-3 p-4">
                  <div className="text-sm font-semibold">{t("All candidate diseases")}</div>
                  {ranked.map((r: any, i: number) => (
                    <div key={`${r.disease}-${i}`} className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.disease}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.votes} {t("photo")}{r.votes > 1 ? "s" : ""} · {t("avg")} {pct(r.avgConfidence)}% · {t("peak")} {pct(r.peakConfidence)}%
                        </div>
                        <div className="mt-1"><Bar value={pct(r.score) ?? 0} /></div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-primary">{pct(r.score)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {recs.length > 0 && (
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("Recommendations")}</div>
                  <ul className="space-y-1 text-sm">
                    {recs.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {chemicals.length > 0 && (
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <div className="mb-1 text-xs font-semibold uppercase text-primary">{t("Suggested treatments")}</div>
                  <ul className="space-y-1 text-sm">
                    {chemicals.map((r, i) => <li key={i}>• {r}</li>)}
                  </ul>
                </CardContent>
              </Card>
            )}

            {row.raw && (
              <Card className="shadow-soft">
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => setShowJson((s) => !s)}
                    className="flex w-full items-center justify-between text-sm font-semibold"
                  >
                    {t("Raw model output")}
                    <ChevronDown className={`h-4 w-4 transition-transform ${showJson ? "rotate-180" : ""}`} />
                  </button>
                  {showJson && (
                    <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-muted p-3 text-[11px] leading-relaxed">
                      {JSON.stringify(row.raw, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}

            {!row.raw && (
              <p className="px-1 text-xs text-muted-foreground">
                {t("This scan was saved before detailed model outputs were recorded, so only the summary above is available.")}
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{label}</span>
      <Bar value={value} />
      <span className="w-10 shrink-0 text-right text-xs font-semibold">{value}%</span>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}
