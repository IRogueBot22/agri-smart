import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";

const Body = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  kind: z.enum(["weather", "advisory", "disease", "info"]).default("info"),
  save: z.boolean().default(true),
  /** IANA timezone of the device, used to evaluate quiet hours. */
  tz: z.string().max(64).optional(),
});

/**
 * Sends a push notification to every device the calling farmer has
 * registered (Android + iOS via Firebase Cloud Messaging) and records it
 * in their in-app alerts list.
 *
 *   POST /api/public/push/send   (Authorization: Bearer <supabase token>)
 */
export const Route = createFileRoute("/api/public/push/send")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      POST: async ({ request }) => {
        try {
          const caller = await authenticateRequest(request);
          if (!caller) return json({ error: "Unauthorized" }, 401);

          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return json({ error: "Invalid body" }, 400);
          const { title, body, kind, save } = parsed.data;

          const { isPushConfigured, sendToDevices } = await import(
            "@/lib/fcm.server"
          );
          if (!isPushConfigured()) {
            return json(
              {
                error:
                  "Push is not configured. Add the FCM_SERVICE_ACCOUNT_JSON secret.",
              },
              503,
            );
          }

          const { data: devices } = await caller.supabase
            .from("device_tokens")
            .select("token")
            .eq("user_id", caller.userId);

          const tokens = (devices ?? []).map((d: any) => d.token as string);
          if (tokens.length === 0) {
            return json({ error: "No registered devices" }, 404);
          }

          const result = await sendToDevices(tokens, { title, body, kind });

          if (result.invalidTokens.length) {
            await caller.supabase
              .from("device_tokens")
              .delete()
              .in("token", result.invalidTokens);
          }

          if (save) {
            await caller.supabase.from("notifications").insert({
              user_id: caller.userId,
              kind,
              title,
              body,
            });
          }

          return json({
            sent: result.sent,
            failed: result.failed,
            devices: tokens.length,
          });
        } catch (e: any) {
          console.error("[api/push/send]", e?.message ?? e);
          return json({ error: e?.message ?? "Push failed" }, 500);
        }
      },
    },
  },
});
