import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

const FieldMap = lazy(() => import("@/components/field-map").then((m) => ({ default: m.FieldMap })));

export const Route = createFileRoute("/_authenticated/fields/$id")({
  head: () => ({ meta: [
    { title: "Field Details — AgriSmart AI" },
    { name: "description", content: "Field boundary, soil, crop, and AI advisory options." },
  ]}),
  component: FieldDetails,
});

function FieldDetails() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [f, setF] = useState<any>(null);
  useEffect(() => { supabase.from("fields").select("*").eq("id", id).single().then(({ data }) => setF(data)); }, [id]);

  async function del() {
    if (!confirm(t("Delete this field?"))) return;
    const { error } = await supabase.from("fields").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("Deleted"));
    navigate({ to: "/fields" });
  }

  if (!f) return <AppShell title={t("Field")}><div className="p-6 text-sm text-muted-foreground">{t("Loading…")}</div></AppShell>;

  const initial = (f.polygon as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);

  return (
    <AppShell title={t("Field Details")} back="/fields">
      <div className="space-y-4 px-4 pt-4">
        <Suspense fallback={<div className="h-64 rounded-2xl bg-muted" />}>
          <FieldMap initial={initial} readOnly height={240} />
        </Suspense>
        <Card className="shadow-soft"><CardContent className="space-y-2 p-4 text-sm">
          <Row k={t("Field name")} v={f.name} />
          <Row k={t("Area")} v={`${Number(f.area_acres).toFixed(3)} ${t("acres")}`} />
          <Row k={t("Location")} v={`${Number(f.centroid_lat).toFixed(4)}° N, ${Number(f.centroid_lng).toFixed(4)}° E`} />
          <Row k={t("Crop")} v={f.crop || "—"} />
          <Row k={t("Soil")} v={f.soil_type || "—"} />
          <Row k={t("Water")} v={f.water_source || "—"} />
        </CardContent></Card>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/advisor" search={{ field: f.id }}>
            <Button className="w-full bg-gradient-primary shadow-soft"><Sparkles className="mr-2 h-4 w-4" />{t("AI Advisor")}</Button>
          </Link>
          <Button variant="outline" onClick={del} className="w-full text-destructive"><Trash2 className="mr-2 h-4 w-4" />{t("Delete")}</Button>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-border/50 py-1.5 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
