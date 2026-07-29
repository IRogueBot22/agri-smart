import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest } from "@/lib/api-auth.server";
import { json, preflight } from "@/lib/api-cors";
import { generatePlainText } from "@/lib/ai-core.server";

const Body = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(30)
    .optional()
    .default([]),
});

const SYSTEM =
  "You are AgriSmart AI, a friendly advisor for Indian farmers. Answer briefly and " +
  "practically about crops, soil, irrigation, pests, weather and government schemes. " +
  "Use simple language and metric/Indian units (acres, quintals, ₹).";

export const Route = createFileRoute("/api/public/ai/chat")({
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

          const history = parsed.data.history.filter(
            (m) => m.content.trim().length > 0,
          );
          const last = history[history.length - 1];
          const messages =
            last?.role === "user" && last.content === parsed.data.message
              ? history
              : [...history, { role: "user" as const, content: parsed.data.message }];

          const reply = await generatePlainText(SYSTEM, messages);
          return json({ reply });
        } catch (e: any) {
          console.error("[api/ai/chat]", e?.message ?? e);
          return json({ error: e?.message ?? "Chat failed" }, 500);
        }
      },
    },
  },
});
