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
import { LogOut, User, KeyRound, Lock, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import { RegionPicker } from "@/components/region-picker";
import { validateRegion, type RegionErrors } from "@/lib/region-schema";
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
  const [regionErrors, setRegionErrors] = useState<RegionErrors>({});

  // Password change
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      setP(data);
    })();
  }, []);

  async function save() {
    const region = {
      country: p.country || "India",
      state: p.state,
      district: p.district,
      mandal: p.mandal,
      village: p.village,
    };
    const { ok, errors } = validateRegion(region);
    setRegionErrors(errors);
    if (!ok) return toast.error(t("Please complete your location"));

    const { error } = await supabase.from("profiles").update({
      full_name: (p.full_name ?? "").trim().slice(0, 100),
      phone: (p.phone ?? "").trim().slice(0, 20),
      country: region.country,
      village: region.village || null,
      mandal: region.mandal || null,
      district: region.district,
      state: region.state,
      language: p.language,
    }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("Saved"));
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match.");
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully!");
        setNewPassword("");
        setConfirmPassword("");
        setPwdOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setPwdLoading(false);
    }
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
      <div className="space-y-4 px-4 pt-4 pb-8">
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
          <RegionPicker
            value={{ country: p.country, state: p.state, district: p.district, mandal: p.mandal, village: p.village }}
            errors={regionErrors}
            onChange={(v) => { setP({ ...p, ...v }); setRegionErrors({}); }}
          />
          <p className="text-xs text-muted-foreground">{t("Schemes and market prices are shown for this location.")}</p>
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

        {/* Security / Password Management */}
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-medium">
                <Lock className="h-4 w-4 text-primary" />
                <span>Account Security</span>
              </div>
              <div className="text-xs text-muted-foreground">Change your login password</div>
            </div>

            <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <KeyRound className="h-3.5 w-3.5" /> Change Password
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="h-5 w-5 text-primary" /> Change Password
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Enter a new password for your account (minimum 6 characters).
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleChangePassword} className="space-y-3.5 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pwd" className="text-xs">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new-pwd"
                        type={showNewPwd ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPwd(!showNewPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pwd" className="text-xs">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-pwd"
                        type={showConfirmPwd ? "text" : "password"}
                        required
                        minLength={6}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPwdOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={pwdLoading}
                      className="bg-gradient-primary shadow-soft text-xs"
                    >
                      {pwdLoading ? "Saving…" : "Update Password"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

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

