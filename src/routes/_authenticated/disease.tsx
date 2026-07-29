import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { detectDisease } from "@/lib/advisor.functions";
import { combineDiagnoses, rankDiagnoses, type RankedDisease } from "@/lib/rank-diagnoses";
import { supabase } from "@/integrations/supabase/client";
import { ScanHistory } from "@/components/scan-history";
import { Camera, Upload, Bug, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const MAX_PHOTOS = 5;

export const Route = createFileRoute("/_authenticated/disease")({
  head: () => ({ meta: [
    { title: "Leaf Disease Detection — AgriSmart AI" },
    { name: "description", content: "Upload several leaf photos and let AI rank the most likely plant disease." },
  ]}),
  component: Disease,
});

type Shot = { file: File; preview: string };

function Disease() {
  const [shots, setShots] = useState<Shot[]>([]);
  const [ranked, setRanked] = useState<RankedDisease[] | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const run = useServerFn(detectDisease);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const room = MAX_PHOTOS - shots.length;
    if (picked.length > room) toast.warning(`Only ${MAX_PHOTOS} photos can be scanned at once`);
    const valid = picked.slice(0, Math.max(room, 0)).filter((f) => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} is too large (max 10MB)`); return false; }
      return true;
    });
    Promise.all(
      valid.map((file) => new Promise<Shot>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ file, preview: reader.result as string });
        reader.readAsDataURL(file);
      })),
    ).then((next) => {
      setShots((s) => [...s, ...next]);
      setResult(null);
      setRanked(null);
    });
  }

  function removeShot(i: number) {
    setShots((s) => s.filter((_, idx) => idx !== i));
    setResult(null);
    setRanked(null);
  }

  async function analyze() {
    if (!shots.length) return;
    setLoading(true);
    setResult(null);
    setRanked(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;

      setStage(`Uploading ${shots.length} leaf photo${shots.length > 1 ? "s" : ""}…`);
      const stamp = Date.now();
      const paths = await Promise.all(shots.map(async (s, i) => {
        const ext = s.file.name.split(".").pop() || "jpg";
        const path = `${uid}/${stamp}_${i}.${ext}`;
        const { error } = await supabase.storage.from("leaf-scans").upload(path, s.file, {
          contentType: s.file.type || "image/jpeg",
          upsert: false,
        });
        if (error) throw error;
        return path;
      }));

      setStage("Running disease detection on each photo…");
      const settled = await Promise.allSettled(
        shots.map((s, i) => run({ data: { imageDataUrl: s.preview, storagePath: paths[i] } })),
      );
      const ok = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value as any] : []));
      if (!ok.length) throw new Error((settled[0] as PromiseRejectedResult).reason?.message ?? "Analysis failed");

      setStage("Ranking results…");
      setRanked(rankDiagnoses(ok));
      setResult(combineDiagnoses(ok));
      setStage("");
      const failed = settled.length - ok.length;
      toast.success(`Diagnosis complete${failed ? ` (${failed} photo${failed > 1 ? "s" : ""} failed)` : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
      setStage("");
    }
    setLoading(false);
  }

  const conf = Number(result?.avgConfidence ?? 0);
  const sevColor =
    result?.severity === "High" ? "bg-destructive/15 text-destructive" :
    result?.severity === "Medium" ? "bg-amber-500/15 text-amber-700" :
    result?.severity === "Low" ? "bg-yellow-500/15 text-yellow-700" :
    "bg-emerald-500/15 text-emerald-700";

  return (
    <AppShell title="Disease Detection" back="/home">
      <div className="space-y-4 px-4 pt-4">
        <Card className="shadow-soft"><CardContent className="p-4">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            Add up to {MAX_PHOTOS} clear photos of the affected leaves — more angles give a more reliable ranking
          </p>
          {shots.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {shots.map((s, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl">
                  <img src={s.preview} alt={`leaf ${i + 1}`} className="h-24 w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeShot(i)}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground shadow"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-auto flex h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
              <Bug className="h-12 w-12 text-primary/70" />
              <p className="mt-2 text-xs text-muted-foreground">Tap upload or camera below</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFiles} />
            <Button variant="outline" disabled={shots.length >= MAX_PHOTOS} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Upload
            </Button>
            <Button variant="outline" disabled={shots.length >= MAX_PHOTOS} onClick={() => camRef.current?.click()}>
              <Camera className="mr-2 h-4 w-4" />Camera
            </Button>
          </div>
          {shots.length > 0 && (
            <Button onClick={analyze} disabled={loading} className="mt-3 w-full bg-gradient-primary shadow-soft">
              {loading
                ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stage || "Analyzing…"}</>)
                : `Detect Disease (${shots.length} photo${shots.length > 1 ? "s" : ""})`}
            </Button>
          )}
        </CardContent></Card>

        {result && (
          <Card className="shadow-soft border-primary/30"><CardContent className="p-4 text-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  Combined diagnosis{result.crop ? ` · ${result.crop}` : ""} · {result.imagesAnalyzed} photo{result.imagesAnalyzed > 1 ? "s" : ""} · {result.agreement}% agreement
                </div>
                <div className="text-2xl font-bold text-primary leading-tight">{result.disease}</div>
                {result.severity && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${sevColor}`}>
                    Severity: {result.severity}
                  </span>
                )}
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shrink-0">{conf}% conf.</div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, conf))}%` }} />
            </div>

            {result.description && <p className="text-sm">{result.description}</p>}

            {result.recommendation?.length > 0 && (
              <div className="rounded-xl bg-accent/10 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-accent-foreground">Recommendations</div>
                <ul className="space-y-1 text-sm">{result.recommendation.map((r: string, i: number) => <li key={i}>• {r}</li>)}</ul>
              </div>
            )}

            {result.chemicals?.length > 0 && (
              <div className="rounded-xl bg-primary/5 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-primary">Suggested treatments</div>
                <ul className="space-y-1 text-sm">{result.chemicals.map((r: string, i: number) => <li key={i}>• {r}</li>)}</ul>
              </div>
            )}
          </CardContent></Card>
        )}

        {ranked && ranked.length > 1 && (
          <Card className="shadow-soft"><CardContent className="p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Ranked candidates</div>
              <div className="text-xs text-muted-foreground">Across all uploaded photos</div>
            </div>
            {ranked.map((r, i) => (
              <div key={r.disease + i} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.disease}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.votes} photo{r.votes > 1 ? "s" : ""} · avg {r.avgConfidence}% · peak {r.peakConfidence}% · photos #{r.imageIndexes.map((n) => n + 1).join(", #")}
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, r.score))}%` }} />
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-primary">{r.score}</span>
              </div>
            ))}
          </CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}
