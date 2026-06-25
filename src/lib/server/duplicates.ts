import { listEmbeddings, listDismissedPairs } from './db';
import { histIntersection } from './colorhist';
import { expandSize } from '$lib/config';

// Een paar is alleen kandidaat als ZOWEL de vorm/categorie (CLIP-cosine) áls de
// kleur (histogram-overlap) genoeg matchen. CLIP alleen verwart gelijk-gevormde
// stukken van verschillende kleur; de kleur-gate dempt dat (empirisch: vals paar
// kleur-overlap ~0.10, zelfde stuk ~0.87+). Beide tunable.
const THRESHOLD = Number(process.env.DUP_THRESHOLD ?? 0.9);
const COLOR_MIN = Number(process.env.DUP_COLOR_MIN ?? 0.4);

export interface DuplicatePair {
  a: number; // a < b (canoniek)
  b: number;
  score: number;
}

function cosine(x: Float32Array, y: Float32Array): number {
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

// Kandidaat-paren: maat-overlap verplicht, cosine ≥ drempel, niet afgewezen.
// Type telt als bonus: gelijke types ranken hoger (geen harde eis).
export function findDuplicatePairs(threshold = THRESHOLD): DuplicatePair[] {
  const rows = listEmbeddings();
  const dismissed = listDismissedPairs();
  const pairs: (DuplicatePair & { sameType: boolean })[] = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const ri = rows[i];
      const rj = rows[j];
      if (!sizesOverlap(ri.size, rj.size)) continue;
      const score = cosine(ri.embedding, rj.embedding);
      if (score < threshold) continue;
      if (histIntersection(ri.colorHist, rj.colorHist) < COLOR_MIN) continue; // kleur-gate
      const [a, b] = ri.id < rj.id ? [ri.id, rj.id] : [rj.id, ri.id];
      if (dismissed.has(`${a}:${b}`)) continue;
      pairs.push({ a, b, score, sameType: !!ri.type && ri.type === rj.type });
    }
  }

  // gelijk type eerst, daarbinnen hoogste similariteit
  pairs.sort((p, q) => Number(q.sameType) - Number(p.sameType) || q.score - p.score);
  return pairs.map(({ a, b, score }) => ({ a, b, score }));
}
