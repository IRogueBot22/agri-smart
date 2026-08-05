import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function LanguageSelector({ className }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  const pick = async (code: string) => {
    setLang(code);
    setOpen(false);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").update({ language: code }).eq("id", data.user.id);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("language")}
          className={cn("gap-1.5 rounded-full px-2 text-muted-foreground", className)}
        >
          <Globe className="h-5 w-5" />
          <span className="text-xs font-medium uppercase">{lang}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>{t("language")}</SheetTitle>
        </SheetHeader>
        <ul className="mt-3 space-y-1 pb-6">
          {INDIAN_LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                onClick={() => pick(l.code)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  l.code === lang ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <span>
                  <span className="font-medium">{l.native}</span>
                  {l.code !== "en" && <span className="ml-2 text-xs text-muted-foreground">{l.english}</span>}
                </span>
                {l.code === lang && <Check className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
