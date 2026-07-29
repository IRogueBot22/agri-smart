import { AI_MODEL, extractJson, requireApiKey } from "@/lib/ai-core.server";

export type LeafDiagnosis = {
  disease: string;
  crop?: string | null;
  severity?: string | null;
  confidence: number | null;
  description?: string | null;
  recommendation: string[];
  chemicals?: string[];
  source: "cnn" | "vision-llm";
};

const SYSTEM =
  "You are a plant pathology expert trained on the PlantVillage disease dataset. " +
  "Identify the disease on the leaf image, estimate a confidence score, and give " +
  "farmer-friendly recommendations. Output strict JSON only.";

function prompt(crop?: string | null, cnnHint?: { label: string; confidence: number } | null) {
  return `Analyze this leaf photo and diagnose the plant disease.${
    crop ? ` The farmer says the crop is ${crop}.` : ""
  }${
    cnnHint
      ? ` A TensorFlow CNN classifier already predicted "${cnnHint.label}" with ${cnnHint.confidence}% confidence — treat it as a strong prior and keep the same disease name unless the image clearly contradicts it.`
      : ""
  }
Respond ONLY as strict JSON matching this exact shape:
{"disease":"<specific disease name or 'Healthy'>","crop":"<detected crop>","severity":"Low","confidence":<0-100 integer>,"description":"<1-2 sentence plain-English explanation>","recommendation":["<organic action>","<chemical action>","<preventive action>"],"chemicals":["<pesticide/fungicide name + dose>"]}
("severity" must be None, Low, Medium or High.)`;
}

/** Calls the Python TensorFlow CNN service, when one is configured. */
export async function classifyWithCnn(
  bytes: ArrayBuffer,
  fileName: string,
  mime: string,
): Promise<{ label: string; confidence: number; crop?: string | null; raw: any } | null> {
  const base = process.env.CNN_SERVICE_URL;
  if (!base) return null;

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), fileName);

  const headers: Record<string, string> = {};
  if (process.env.CNN_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.CNN_SERVICE_TOKEN}`;
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[cnn] ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const j: any = await res.json();
    const label = String(j.disease ?? j.label ?? j.class ?? "").trim();
    if (!label) return null;
    const rawConf = Number(j.confidence ?? j.score ?? 0);
    return {
      label,
      confidence: Math.round(rawConf > 1 ? rawConf : rawConf * 100),
      crop: j.crop ?? null,
      raw: j,
    };
  } catch (e: any) {
    console.error("[cnn] unreachable:", e?.message ?? e);
    return null;
  }
}

/**
 * Full diagnosis pipeline: TensorFlow CNN first (when CNN_SERVICE_URL is set),
 * then the vision LLM to enrich / fall back, always returning structured results.
 */
export async function diagnoseLeaf(opts: {
  imageUrl: string;
  crop?: string | null;
  cnn?: { label: string; confidence: number; crop?: string | null } | null;
}): Promise<LeafDiagnosis> {
  const { imageUrl, crop, cnn } = opts;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": requireApiKey(),
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: prompt(crop ?? cnn?.crop, cnn ?? null) },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err: any = new Error(
      `AI provider error [${res.status}]: ${body.slice(0, 300)}`,
    );
    err.status = res.status === 429 || res.status === 402 ? res.status : 502;
    // If the CNN already answered, degrade gracefully instead of failing.
    if (cnn) {
      return {
        disease: cnn.label,
        crop: cnn.crop ?? crop ?? null,
        severity: null,
        confidence: cnn.confidence,
        description: null,
        recommendation: [],
        source: "cnn",
      };
    }
    throw err;
  }

  const j: any = await res.json();
  const out = extractJson(j.choices?.[0]?.message?.content ?? "") as any;

  const recommendation = Array.isArray(out.recommendation)
    ? out.recommendation.map(String)
    : out.recommendation
      ? [String(out.recommendation)]
      : [];

  return {
    disease: String(out.disease ?? cnn?.label ?? "Unknown"),
    crop: out.crop ?? cnn?.crop ?? crop ?? null,
    severity: out.severity ?? null,
    confidence: cnn
      ? cnn.confidence
      : typeof out.confidence === "number"
        ? out.confidence
        : null,
    description: out.description ?? null,
    recommendation,
    chemicals: Array.isArray(out.chemicals) ? out.chemicals.map(String) : [],
    source: cnn ? "cnn" : "vision-llm",
  };
}
