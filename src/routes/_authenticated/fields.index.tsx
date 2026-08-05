import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Leaf, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/fields/")({
  head: () => ({ meta: [
    { title: "My Fields — AgriSmart AI" },
    { name: "description", content: "All your mapped farm fields with area, crop, and soil." },
  ]}),
  component: FieldsList,
});

function FieldsList() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("fields").select("*").order("created_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <AppShell title={t("My Fields")}>
      <div className="space-y-3 px-4 pt-4">
        <Link to="/fields/new"><Button className="w-full bg-gradient-primary shadow-soft"><Plus className="mr-2 h-4 w-4" />{t("Add Field")}</Button></Link>
        {rows.length === 0 && <p className="mt-6 text-center text-sm text-muted-foreground">{t("No fields yet — draw one!")}</p>}
        {rows.map((f) => (
          <Link key={f.id} to="/fields/$id" params={{ id: f.id }}>
            <Card className="shadow-soft">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-2xl bg-primary/10 p-3"><Leaf className="h-6 w-6 text-primary" /></div>
                <div className="flex-1">
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{Number(f.area_acres).toFixed(2)} {t("acres")} · {f.crop || t("No crop")} · {f.soil_type || t("Soil?")}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
