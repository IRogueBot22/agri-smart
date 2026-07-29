/**
 * Pure helpers for combining several leaf diagnoses (one per uploaded photo)
 * into a single ranked verdict. Shared by the server scan route and the web UI.
 */

export type SingleDiagnosis = {
  disease: string;
  crop?: string | null;
  severity?: string | null;
  confidence: number | null;
  description?: string | null;
  recommendation?: string[];
  chemicals?: string[];
  source?: string;
};

export type RankedDisease = {
  disease: string;
  crop: string | null;
  severity: string | null;
  /** How many of the uploaded photos produced this diagnosis. */
  votes: number;
  /** Average model confidence across those photos (0-100). */
  avgConfidence: number;
  /** Highest single-photo confidence (0-100). */
  peakConfidence: number;
  /** Combined ranking score (0-100): confidence weighted by agreement. */
  score: number;
  /** Indexes of the uploaded images that produced this diagnosis. */
  imageIndexes: number[];
  description: string | null;
  recommendation: string[];
  chemicals: string[];
};

export type CombinedDiagnosis = RankedDisease & {
  imagesAnalyzed: number;
  /** true when the photos disagreed on the disease. */
  conflicting: boolean;
  agreement: number;
};

const SEVERITY_ORDER = ["None", "Low", "Medium", "High"];

function key(name: string) {
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function uniq(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const k = item.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}

function worstSeverity(list: (string | null | undefined)[]) {
  let best: string | null = null;
  let bestIdx = -1;
  for (const s of list) {
    if (!s) continue;
    const idx = SEVERITY_ORDER.findIndex(
      (x) => x.toLowerCase() === String(s).trim().toLowerCase(),
    );
    if (idx > bestIdx) {
      bestIdx = idx;
      best = SEVERITY_ORDER[idx];
    }
  }
  return best;
}

/**
 * Ranks diagnoses across photos. Diseases seen in more photos rank higher,
 * with average confidence breaking ties:
 *   score = avgConfidence * (0.6 + 0.4 * votes / totalPhotos)
 */
export function rankDiagnoses(results: SingleDiagnosis[]): RankedDisease[] {
  const total = results.length || 1;
  const groups = new Map<string, { items: SingleDiagnosis[]; idx: number[] }>();

  results.forEach((r, i) => {
    const k = key(r.disease || "Unknown");
    const g = groups.get(k) ?? { items: [], idx: [] };
    g.items.push(r);
    g.idx.push(i);
    groups.set(k, g);
  });

  const ranked: RankedDisease[] = [...groups.values()].map(({ items, idx }) => {
    const confs = items.map((i) => Number(i.confidence ?? 0));
    const avg = confs.reduce((a, b) => a + b, 0) / items.length;
    const peak = Math.max(...confs);
    const votes = items.length;
    // Prefer the most confident sample for the human-readable copy.
    const lead = items.reduce((a, b) =>
      Number(b.confidence ?? 0) > Number(a.confidence ?? 0) ? b : a,
    );
    return {
      disease: lead.disease || "Unknown",
      crop: lead.crop ?? items.find((i) => i.crop)?.crop ?? null,
      severity: worstSeverity(items.map((i) => i.severity)),
      votes,
      avgConfidence: Math.round(avg),
      peakConfidence: Math.round(peak),
      score: Math.round(avg * (0.6 + (0.4 * votes) / total)),
      imageIndexes: idx,
      description: lead.description ?? null,
      recommendation: uniq(items.flatMap((i) => i.recommendation ?? [])),
      chemicals: uniq(items.flatMap((i) => i.chemicals ?? [])),
    };
  });

  return ranked.sort(
    (a, b) => b.score - a.score || b.votes - a.votes || b.peakConfidence - a.peakConfidence,
  );
}

/** Top-ranked disease plus agreement metadata across all photos. */
export function combineDiagnoses(results: SingleDiagnosis[]): CombinedDiagnosis | null {
  const ranked = rankDiagnoses(results);
  if (!ranked.length) return null;
  const top = ranked[0];
  return {
    ...top,
    imagesAnalyzed: results.length,
    conflicting: ranked.length > 1,
    agreement: Math.round((top.votes / results.length) * 100),
  };
}
