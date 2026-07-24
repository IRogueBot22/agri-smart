import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { detectDisease } from "@/lib/advisor.functions";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Upload, Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/disease")({
  head: () => ({ meta: [
    { title: "Leaf Disease Detection — AgriSmart AI" },
    { name: "description", content: "Upload a leaf photo and let AI diagnose the plant disease." },
  ]}),
  component: Disease,
});

function Disease() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const run = useServerFn(detectDisease);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("Image too large (max 10MB)");
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result as string); setResult(null); };
    reader.readAsDataURL(f);
  }

  async function analyze() {
    if (!preview || !file) return;
    setLoading(true);
    setResult(null);
    try {
      // 1) Upload leaf image to private storage bucket
      setStage("Uploading leaf image…");
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("leaf-scans").upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
      if (upErr) throw upErr;

      // 2) Run detection (vision model, PlantVillage-style categories)
      setStage("Running disease detection model…");
      const r = await run({ data: { imageDataUrl: preview, storagePath: path } });
      setResult(r);
      setStage("");
      toast.success("Diagnosis complete");
    } catch (e: any) {
      toast.error(e.message ?? "Analysis failed");
      setStage("");
    }
    setLoading(false);
  }

  const conf = Number(result?.confidence ?? 0);
  const sevColor =
    result?.severity === "High" ? "bg-destructive/15 text-destructive" :
    result?.severity === "Medium" ? "bg-amber-500/15 text-amber-700" :
    result?.severity === "Low" ? "bg-yellow-500/15 text-yellow-700" :
    "bg-emerald-500/15 text-emerald-700";

  return (
    <AppShell title="Disease Detection" back="/home">
      <div className="space-y-4 px-4 pt-4">
        <Card className="shadow-soft"><CardContent className="p-4">
          <p className="mb-3 text-center text-sm text-muted-foreground">Upload a clear image of the affected leaf</p>
          {preview ? (
            <img src={preview} alt="leaf" className="mx-auto max-h-72 rounded-2xl" />
          ) : (
            <div className="mx-auto flex h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
              <Bug className="h-12 w-12 text-primary/70" />
              <p className="mt-2 text-xs text-muted-foreground">Tap upload or camera below</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload</Button>
            <Button variant="outline" onClick={() => camRef.current?.click()}><Camera className="mr-2 h-4 w-4" />Camera</Button>
          </div>
          {preview && (
            <Button onClick={analyze} disabled={loading} className="mt-3 w-full bg-gradient-primary shadow-soft">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stage || "Analyzing…"}</>) : "Detect Disease"}
            </Button>
          )}
        </CardContent></Card>

        {result && (
          <Card className="shadow-soft border-primary/30"><CardContent className="p-4 text-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Diagnosis{result.crop ? ` · ${result.crop}` : ""}</div>
                <div className="text-2xl font-bold text-primary leading-tight">{result.disease}</div>
                {result.severity && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${sevColor}`}>
                    Severity: {result.severity}
                  </span>
                )}
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shrink-0">{conf}% conf.</div>
            </div>

            {/* Confidence bar */}
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
      </div>
    </AppShell>
  );
}
