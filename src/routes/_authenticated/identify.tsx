import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { identifySpecimen } from "@/lib/identify.functions";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INDIAN_STATES, districtsFor } from "@/lib/regions";
import { Camera, Upload, Loader2, Sprout, Leaf, Wheat, AlertTriangle, ShieldCheck, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/identify")({
  head: () => ({ meta: [
    { title: "Weed, Plant & Seed Identification — AgriSmart AI" },
    { name: "description", content: "Snap a photo to identify weeds, plants and seeds, see whether they are harmful or useful, and get control advice in your language." },
    { property: "og:title", content: "Weed, Plant & Seed Identification — AgriSmart AI" },
    { property: "og:description", content: "AI identification of weeds, plants and seeds with uses, harms and control steps in 20+ Indian languages." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Identify,
});

type Mode = "weed" | "plant" | "seed";

const MAX_IMAGES = 5;

function Identify() {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<Mode>("weed");
  const [shots, setShots] = useState<{ preview: string; file: File }[]>([]);
  const [result, setResult] = useState<any>(null);
  const [state, setState] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const run = useServerFn(identifySpecimen);

  // Prefill region from saved choice, else from the farmer profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedState = localStorage.getItem("agri.region.state") ?? "";
      const savedDistrict = localStorage.getItem("agri.region.district") ?? "";
      if (savedState) {
        setState(savedState);
        setDistrict(savedDistrict);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("state, district").eq("id", u.user.id).maybeSingle();
      if (cancelled || !p) return;
      const st = INDIAN_STATES.find((s) => s.toLowerCase() === (p.state ?? "").trim().toLowerCase());
      if (st) {
        setState(st);
        const d = districtsFor(st).find((x) => x.toLowerCase() === (p.district ?? "").trim().toLowerCase());
        if (d) setDistrict(d);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function pickState(v: string) {
    setState(v);
    setDistrict("");
    localStorage.setItem("agri.region.state", v);
    localStorage.removeItem("agri.region.district");
    setResult(null);
  }
  function pickDistrict(v: string) {
    setDistrict(v);
    localStorage.setItem("agri.region.district", v);
    setResult(null);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!picked.length) return;
    const room = MAX_IMAGES - shots.length;
    if (room <= 0) return toast.error(`${t("Maximum")} ${MAX_IMAGES} ${t("photos per scan")}`);
    const accepted = picked.slice(0, room).filter((f) => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: ${t("image too large (max 10MB)")}`); return false; }
      return true;
    });
    if (picked.length > room) toast.info(`${t("Only")} ${room} ${t("more photo")}${room > 1 ? "s" : ""} ${t("added (max")} ${MAX_IMAGES})`);
    accepted.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => setShots((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, { preview: reader.result as string, file: f }]));
      reader.readAsDataURL(f);
    });
    setResult(null);
  }

  function removeShot(i: number) {
    setShots((prev) => prev.filter((_, idx) => idx !== i));
    setResult(null);
  }

  async function analyze() {
    if (!shots.length) return;
    setLoading(true);
    setResult(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const storagePaths: string[] = [];
      for (const [i, s] of shots.entries()) {
        const ext = s.file.name.split(".").pop() || "jpg";
        const path = `${uid}/${mode}_${Date.now()}_${i}.${ext}`;
        const { error } = await supabase.storage.from("leaf-scans").upload(path, s.file, {
          contentType: s.file.type || "image/jpeg",
        });
        if (!error) storagePaths.push(path);
      }

      const out = await run({
        data: {
          imageDataUrls: shots.map((s) => s.preview),
          mode,
          language: lang,
          storagePaths,
          ...(state ? { state } : {}),
          ...(district ? { district } : {}),
        },
      });
      setResult(out);
      toast.success(t("results"));
    } catch (e: any) {
      toast.error(e.message ?? t("Identification failed"));
    }
    setLoading(false);
  }

  const verdict = result?.verdict as string | undefined;
  const harmful = verdict === "harmful" || result?.harm_level === "High";
  const conf = Number(result?.confidence ?? 0);

  const modes: { key: Mode; icon: any; label: string }[] = [
    { key: "weed", icon: Sprout, label: t("weed") },
    { key: "plant", icon: Leaf, label: t("plant") },
    { key: "seed", icon: Wheat, label: t("seed") },
  ];

  return (
    <AppShell title={t("identify")} back="/home">
      <div className="space-y-4 px-4 pt-4">
        <p className="text-sm text-muted-foreground">{t("identifyDesc")}</p>

        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => {
            const Icon = m.icon;
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => { setMode(m.key); setResult(null); }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-medium transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {m.label}
              </button>
            );
          })}
        </div>

        <Card className="shadow-soft"><CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" /> {t("Your region")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={state} onValueChange={pickState}>
              <SelectTrigger aria-label={t("State")}><SelectValue placeholder={t("State")} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={district} onValueChange={pickDistrict} disabled={!state}>
              <SelectTrigger aria-label={t("District")}><SelectValue placeholder={state ? t("District") : t("Pick state first")} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {districtsFor(state).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {state
              ? `${t("Control steps, doses and safe options will be tailored to")} ${district ? district + ", " : ""}${state}.`
              : t("Choose your state and district to get control advice suited to your area.")}
          </p>
        </CardContent></Card>

        <Card className="shadow-soft"><CardContent className="p-4">
          {shots.length > 0 ? (
            <>
              <img src={shots[0]!.preview} alt={`${mode} ${t("to identify")}`} className="mx-auto max-h-56 rounded-2xl object-contain" />
              <div className="mt-3 flex flex-wrap gap-2">
                {shots.map((s, i) => (
                  <div key={i} className="relative">
                    <img src={s.preview} alt={`${t("Angle")} ${i + 1}`} className="h-16 w-16 rounded-xl border border-border object-cover" />
                    <button
                      onClick={() => removeShot(i)}
                      aria-label={`${t("Remove photo")} ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-soft"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {shots.length}/{MAX_IMAGES} {t("photos — add more angles (top, underside, close-up) for better accuracy.")}
              </p>
            </>
          ) : (
            <div className="mx-auto flex h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
              <Sprout className="h-12 w-12 text-primary/70" />
              <p className="mt-2 px-6 text-center text-xs text-muted-foreground">{t("identifyDesc")}</p>
              <p className="mt-1 px-6 text-center text-xs text-muted-foreground">{t("Add up to")} {MAX_IMAGES} {t("photos from different angles.")}</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
            <Button variant="outline" disabled={shots.length >= MAX_IMAGES} onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t("upload")}</Button>
            <Button variant="outline" disabled={shots.length >= MAX_IMAGES} onClick={() => camRef.current?.click()}><Camera className="mr-2 h-4 w-4" />{t("camera")}</Button>
          </div>

          {shots.length > 0 && (
            <Button onClick={analyze} disabled={loading} className="mt-3 w-full bg-gradient-primary shadow-soft">
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("analyzing")}</>) : `${t("analyze")} (${shots.length})`}
            </Button>
          )}
        </CardContent></Card>

        {result && (
          <Card className="border-primary/30 shadow-soft"><CardContent className="space-y-3 p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-bold leading-tight text-primary">{result.name}</div>
                {result.scientific_name && <div className="text-xs italic text-muted-foreground">{result.scientific_name}{result.family ? ` · ${result.family}` : ""}</div>}
                {result.local_names?.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{result.local_names.join(" · ")}</div>}
              </div>
              <div className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{conf}%</div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-primary" style={{ width: `${Math.max(0, Math.min(100, conf))}%` }} />
            </div>

            <div className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold",
              harmful ? "bg-destructive/15 text-destructive" : verdict === "mixed" ? "bg-amber-500/15 text-amber-700" : "bg-primary/10 text-primary",
            )}>
              {harmful ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {harmful ? t("harmful") : verdict === "mixed" ? `${t("harmful")} / ${t("beneficial")}` : t("beneficial")}
              {result.harm_level && <span className="font-normal opacity-80">· {result.harm_level}</span>}
            </div>

            {result.description && <p>{result.description}</p>}

            <Section title={t("harmful")} items={result.harms} tone="destructive" />
            <Section title={t("uses")} items={result.uses} tone="primary" />
            {(state || result.region_notes?.length) && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {t("Advice tailored for")} {district ? `${district}, ` : ""}{state || t("India")}
              </div>
            )}
            <Section title={t("Regional notes")} items={result.region_notes} tone="primary" />
            <Section title={t("control")} items={result.control} tone="accent" />
            <Section title={`${t("control")} — ${district || state || t("region")}`} items={result.regional_control} tone="accent" />
            <Section title={t("Safe options")} items={result.safe_options} tone="primary" />
            <Section title="⚠" items={result.safety} tone="amber" />

            {result.candidates?.length > 0 && (
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("confidence")}</div>
                <ul className="space-y-1 text-sm">
                  {result.candidates.map((c: any, i: number) => (
                    <li key={i} className="flex justify-between"><span>{c.name}</span><span className="text-muted-foreground">{c.confidence}%</span></li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, items, tone }: { title: string; items?: string[]; tone: string }) {
  if (!items?.length) return null;
  const bg = tone === "destructive" ? "bg-destructive/10" : tone === "accent" ? "bg-accent/10" : tone === "amber" ? "bg-amber-500/10" : "bg-primary/5";
  return (
    <div className={cn("rounded-xl p-3", bg)}>
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <ul className="space-y-1 text-sm">{items.map((x, i) => <li key={i}>• {x}</li>)}</ul>
    </div>
  );
}
