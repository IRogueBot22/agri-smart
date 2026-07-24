// Splash → routes based on onboarding + auth state
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      const seen = localStorage.getItem("agri-onboarded") === "1";
      if (data.session) navigate({ to: "/home", replace: true });
      else if (!seen) navigate({ to: "/onboarding", replace: true });
      else navigate({ to: "/auth", replace: true });
    }, 1800);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="animate-in fade-in zoom-in duration-700">
        <Logo size={96} />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">AgriSmart AI</h1>
      <p className="mt-1 text-sm opacity-90">Smart Advice, Better Harvest</p>
      <div className="mt-10 h-1.5 w-32 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-white/80" />
      </div>
    </div>
  );
}
