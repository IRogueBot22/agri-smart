import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { PolygonResult } from "@/components/field-map";
import { useI18n } from "@/lib/i18n";

const FieldMap = lazy(() => import("@/components/field-map").then((m) => ({ default: m.FieldMap })));

export const Route = createFileRoute("/_authenticated/fields/new")({
  head: () => ({ meta: [
    { title: "Draw Your Field — AgriSmart AI" },
    { name: "description", content: "Draw a polygon around your farm to auto-calculate its area." },
  ]}),
  component: DrawField,
});

const SOILS = ["Black Soil", "Red Soil", "Sandy Soil", "Loamy Soil", "Alluvial", "Clay"];
const WATER = ["Borewell", "Canal", "Rainfed", "River", "Pond", "Drip Irrigation"];

function DrawField() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [poly, setPoly] = useState<PolygonResult | null>(null);
  const [name, setName] = useState("");
  const [crop, setCrop] = useState("");
  const [soil, setSoil] = useState("");
  const [water, setWater] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!poly) return toast.error(t("Draw at least 3 points on the map first"));
    if (!name) return toast.error(t("Give the field a name"));
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("fields").insert({
      user_id: u.user!.id,
      name, crop: crop || null, soil_type: soil || null, water_source: water || null,
      polygon: poly.coords,
      centroid_lat: poly.centroid.lat,
      centroid_lng: poly.centroid.lng,
      area_acres: poly.area_acres,
    }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("Field saved!"));
    navigate({ to: "/fields/$id", params: { id: data.id } });
  }

  return (
    <AppShell title={t("Draw Your Field")} back="/fields">
      <div className="space-y-3 px-4 pt-4">
        <p className="text-xs text-muted-foreground">{t("Search or pin your location, then tap on the map to add corners. Tap a marker to remove it.")}</p>
        <Suspense fallback={<div className="h-80 rounded-2xl bg-muted" />}>
          <FieldMap onChange={setPoly} height={340} />
        </Suspense>
        {poly && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-primary/5 p-3 text-sm">
            <div><div className="text-xs text-muted-foreground">{t("Area")}</div><div className="font-semibold">{poly.area_acres.toFixed(3)} {t("acres")}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("Perimeter est.")}</div><div className="font-semibold">{(Math.sqrt(poly.area_m2) * 4 / 1000).toFixed(2)} km</div></div>
          </div>
        )}
        <div className="space-y-3 rounded-2xl border p-3">
          <div><Label>{t("Field name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("South Field")} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>{t("Crop")}</Label><Input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder={t("Rice")} /></div>
            <div>
              <Label>{t("Soil type")}</Label>
              <select value={soil} onChange={(e) => setSoil(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">{t("Select…")}</option>{SOILS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>{t("Water source")}</Label>
            <select value={water} onChange={(e) => setWater(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">{t("Select…")}</option>{WATER.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <Button disabled={loading} onClick={save} className="w-full bg-gradient-primary shadow-soft">{loading ? t("Saving…") : t("Save Field")}</Button>
      </div>
    </AppShell>
  );
}
