// Per-category alert switches (weather, recommendations, disease) plus a
// quiet-hours window, so farmers only get the alerts they want.
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CloudRain, Leaf, Lightbulb, Moon } from "lucide-react";
import { useNotifyPrefs } from "@/hooks/use-notify-prefs";
import { isQuietNow, type NotifyPrefs } from "@/lib/notify-prefs";
import { useI18n } from "@/lib/i18n";

const ROWS: {
  key: keyof Pick<NotifyPrefs, "notify_weather" | "notify_recommendations" | "notify_disease">;
  title: string;
  desc: string;
  Icon: typeof CloudRain;
}[] = [
  { key: "notify_weather", title: "Weather alerts", desc: "Storms, heavy rain, heat and frost warnings", Icon: CloudRain },
  { key: "notify_recommendations", title: "Crop recommendations", desc: "Fertilizer, irrigation and yield advisories", Icon: Lightbulb },
  { key: "notify_disease", title: "Disease alerts", desc: "Leaf scan results and outbreak warnings", Icon: Leaf },
];

export function NotificationSettings() {
  const { t } = useI18n();
  const { prefs, loading, update } = useNotifyPrefs();
  const quietNow = isQuietNow(prefs);

  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-4 p-4">
        <div>
          <div className="font-medium">{t("Notifications")}</div>
          <div className="text-xs text-muted-foreground">
            {t("Choose which alerts reach you")}{loading ? ` — ${t("loading…")}` : ""}
          </div>
        </div>

        {ROWS.map(({ key, title, desc, Icon }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{t(title)}</div>
                <div className="text-xs text-muted-foreground">{t(desc)}</div>
              </div>
            </div>
            <Switch checked={prefs[key]} onCheckedChange={(v) => update({ [key]: v })} />
          </div>
        ))}

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Moon className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{t("Quiet hours")}</div>
                <div className="text-xs text-muted-foreground">
                  {t("Silence all alerts overnight")}
                  {prefs.quiet_hours_enabled && quietNow ? ` — ${t("active right now")}` : ""}
                </div>
              </div>
            </div>
            <Switch
              checked={prefs.quiet_hours_enabled}
              onCheckedChange={(v) => update({ quiet_hours_enabled: v })}
            />
          </div>

          {prefs.quiet_hours_enabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("From")}</Label>
                <Input
                  type="time"
                  value={prefs.quiet_start}
                  onChange={(e) => update({ quiet_start: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">{t("To")}</Label>
                <Input
                  type="time"
                  value={prefs.quiet_end}
                  onChange={(e) => update({ quiet_end: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
