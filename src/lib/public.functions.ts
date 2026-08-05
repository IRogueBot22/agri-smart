import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

type RegionInput = { country?: string | null; state?: string | null; district?: string | null } | undefined;

const regionValidator = (input: RegionInput) => input ?? {};

export const listSchemes = createServerFn({ method: "GET" })
  .inputValidator(regionValidator)
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb.from("government_schemes").select("*");
    if (data?.country) q = q.eq("country", data.country);
    // state-specific schemes for this state + national schemes (state is null)
    if (data?.state) q = q.or(`state.is.null,state.eq.${data.state}`);
    const { data: rows, error } = await q.order("title");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMarketPrices = createServerFn({ method: "GET" })
  .inputValidator(regionValidator)
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb.from("market_prices").select("*");
    if (data?.country) q = q.eq("country", data.country);
    if (data?.state) q = q.eq("state", data.state);
    if (data?.district) q = q.eq("district", data.district);
    const { data: rows, error } = await q.order("crop");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
