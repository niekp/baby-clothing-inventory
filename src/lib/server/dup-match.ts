import { histIntersection } from './colorhist';
import { expandSize } from '$lib/config';

// kandidaat = vorm-match (CLIP-cosine) én kleur-match (histogram-overlap); beide tunable
const THRESHOLD = Number(process.env.DUP_THRESHOLD ?? 0.9);
const COLOR_MIN = Number(process.env.DUP_COLOR_MIN ?? 0.4);

export interface MatchRow {
  id: number;
  size: string;
  type: string | null;
  embedding: Float32Array;
  colorHist: Float32Array;
}

export function cosine(x: Float32Array, y: Float32Array): number {
  if (x.length !== y.length) return -1; // andere dims (modelwissel) → nooit matchen
  let dot = 0;
  for (let i = 0; i < x.length; i++) dot += x[i] * y[i];
  return dot;
}

// Zelfde of overlappende maat (86 overlapt 86/92).
function sizesOverlap(a: string, b: string): boolean {
  const ea = expandSize(a);
  return expandSize(b).some((s) => ea.includes(s));
}

// Score van een kandidaat-paar, of null bij maat-mismatch / cosine onder drempel / kleur-gate.
export function matchScore(a: MatchRow, b: MatchRow): number | null {
  if (!sizesOverlap(a.size, b.size)) return null;
  const score = cosine(a.embedding, b.embedding);
  if (score < THRESHOLD) return null;
  if (histIntersection(a.colorHist, b.colorHist) < COLOR_MIN) return null;
  return score;
}
