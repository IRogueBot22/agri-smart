/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 *
 * Requires the backend secret FCM_SERVICE_ACCOUNT_JSON — the JSON service
 * account downloaded from Firebase console → Project settings → Service
 * accounts → "Generate new private key".
 */

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    return null;
  }
}

export function isPushConfigured() {
  return serviceAccount() !== null;
}

function b64url(input: ArrayBuffer | string) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const jwt = `${header}.${claim}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`FCM auth failed [${res.status}]: ${await res.text()}`);
  }
  const j: any = await res.json();
  cached = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

export type PushMessage = {
  title: string;
  body: string;
  kind?: string;
  data?: Record<string, string>;
};

async function send(target: Record<string, string>, msg: PushMessage) {
  const sa = serviceAccount();
  if (!sa) throw new Error("Push not configured (FCM_SERVICE_ACCOUNT_JSON)");
  const token = await accessToken(sa);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          ...target,
          notification: { title: msg.title, body: msg.body },
          data: { kind: msg.kind ?? "info", ...(msg.data ?? {}) },
          android: {
            priority: "HIGH",
            notification: { channel_id: "agrismart_alerts" },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } },
          },
        },
      }),
    },
  );
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}

/** Sends to every registered device of one farmer; prunes dead tokens. */
export async function sendToDevices(
  tokens: string[],
  msg: PushMessage,
): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];

  for (const t of tokens) {
    try {
      const r = await send({ token: t }, msg);
      if (r.ok) {
        sent++;
      } else {
        failed++;
        if (
          r.status === 404 ||
          r.body.includes("UNREGISTERED") ||
          r.body.includes("INVALID_ARGUMENT")
        ) {
          invalidTokens.push(t);
        }
        console.error(`[fcm] send failed [${r.status}]: ${r.body.slice(0, 300)}`);
      }
    } catch (e: any) {
      failed++;
      console.error("[fcm]", e?.message ?? e);
    }
  }
  return { sent, failed, invalidTokens };
}

/** Broadcast to a topic, e.g. `weather_alerts` or `crop_advisories`. */
export async function sendToTopic(topic: string, msg: PushMessage) {
  const r = await send({ topic }, msg);
  if (!r.ok) throw new Error(`FCM topic send failed [${r.status}]: ${r.body}`);
  return JSON.parse(r.body);
}
