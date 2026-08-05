import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NotificationSettings } from "@/components/notification-settings";
import { LogOut, User } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [
    { title: "Profile — AgriSmart AI" },
    { name: "description", content: "Manage your farmer profile, preferences, and account." },
  ]}),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { setLang, t } = useI18n();
  const [p, setP] = useState<any>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      setP(data);
    })();
  }, []);

  async function save() {
    const { error } = await supabase.from("profiles").update({
      full_name: p.full_name, phone: p.phone, village: p.village, district: p.district, state: p.state, language: p.language,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("Saved"));
  }

  function toggleDark(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("agri-dark", v ? "1" : "0");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!p) return <AppShell title={t("Profile")}><div className="p-6 text-sm text-muted-foreground">{t("Loading…")}</div></AppShell>;

  return (
    <AppShell title={t("Profile")}>
      <div className="space-y-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
            <User className="h-8 w-8" />
          </div>
          <div>
            <div className="text-lg font-bold">{p.full_name || t("Farmer")}</div>
            <div className="text-xs text-muted-foreground">{p.phone || p.email}</div>
          </div>
        </div>

        <Card className="shadow-soft"><CardContent className="space-y-3 p-4">
          <div><Label>{t("Full name")}</Label><Input value={p.full_name ?? ""} onChange={(e) => setP({ ...p, full_name: e.target.value })} /></div>
          <div><Label>{t("Phone")}</Label><Input value={p.phone ?? ""} onChange={(e) => setP({ ...p, phone: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">{t("Village")}</Label><Input value={p.village ?? ""} onChange={(e) => setP({ ...p, village: e.target.value })} /></div>
            <div><Label className="text-xs">{t("District")}</Label><Input value={p.district ?? ""} onChange={(e) => setP({ ...p, district: e.target.value })} /></div>
            <div><Label className="text-xs">{t("State")}</Label><Input value={p.state ?? ""} onChange={(e) => setP({ ...p, state: e.target.value })} /></div>
          </div>
          <div>
            <Label>{t("language")}</Label>
            <select
              value={p.language ?? "en"}
              onChange={(e) => { setP({ ...p, language: e.target.value }); setLang(e.target.value); }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {INDIAN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}{l.code === "en" ? "" : ` (${l.english})`}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t("The app and all AI answers switch to this language.")}</p>
          </div>
          <Button onClick={save} className="w-full bg-gradient-primary shadow-soft">{t("Save changes")}</Button>
        </CardContent></Card>

        <NotificationSettings />

        <Card className="shadow-soft"><CardContent className="flex items-center justify-between p-4">
          <div><div className="font-medium">{t("Dark mode")}</div><div className="text-xs text-muted-foreground">{t("Reduce brightness at night")}</div></div>
          <Switch checked={dark} onCheckedChange={toggleDark} />
        </CardContent></Card>

        <Button variant="outline" onClick={signOut} className="w-full text-destructive"><LogOut className="mr-2 h-4 w-4" />{t("Logout")}</Button>
      </div>
    </AppShell>
  );
}
