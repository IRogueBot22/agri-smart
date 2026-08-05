import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProfileRegion = {
  country: string | null;
  state: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
};

const EMPTY: ProfileRegion = { country: null, state: null, district: null, mandal: null, village: null };

/** Reads the signed-in farmer's saved location (country / state / district / mandal / village). */
export function useProfileRegion() {
  const [region, setRegion] = useState<ProfileRegion>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const { data } = await supabase
          .from("profiles")
          .select("country, state, district, mandal, village")
          .eq("id", u.user.id)
          .maybeSingle();
        if (alive && data) setRegion({ ...EMPTY, ...(data as any) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { region, loading };
}
