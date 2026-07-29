import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";
import {
  ADVICE_SYSTEM,
  adviceToText,
  buildAdvicePrompt,
  fetchWeatherSummary,
  generateJson,
} from "@/lib/ai-core.server";

const Body = z.object({
  kind: z.enum(["crop", "fertilizer", "irrigation", "yield"]),
  field: z.object({ id: z.string().uuid() }).passthrough(),
});

export const Route = createFileRoute("/api/public/ai/advise")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const caller = await authenticateRequest(request);
          if (!caller) return json({ error: "Unauthorized" }, 401);

          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) {
            return json({ error: "Invalid request body" }, 400);
          }
          const { kind } = parsed.data;
          const fieldId = parsed.data.field.id;

          // RLS scopes this to the caller's own fields.
          const { data: field, error } = await caller.supabase
            .from("fields")
            .select("*")
            .eq("id", fieldId)
            .maybeSingle();
          if (error || !field) return json({ error: "Field not found" }, 404);

          const weather = await fetchWeatherSummary(
            field.centroid_lat,
            field.centroid_lng,
          );
          const out = await generateJson(
            ADVICE_SYSTEM[kind],
            buildAdvicePrompt(kind, field as any, weather),
          );

          await caller.supabase.from("recommendations").insert({
            user_id: caller.userId,
            field_id: fieldId,
            kind,
            payload: out as any,
          });

          return json({ ...out, text: adviceToText(out) });
        } catch (e: any) {
          console.error("[api/ai/advise]", e?.message ?? e);
          return json({ error: e?.message ?? "Advice failed" }, 500);
        }
      },
    },
  },
});
