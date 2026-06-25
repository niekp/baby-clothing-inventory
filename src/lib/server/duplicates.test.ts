import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, createItem, dismissDuplicate, setEmbedding, setDbForTesting, type DB } from './db';
import { findDuplicatePairs } from './duplicates';

let db: DB;
beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

// genormaliseerde 2D-embedding onder hoek θ
function emb(theta: number): Float32Array {
  return new Float32Array([Math.cos(theta), Math.sin(theta)]);
}
const SAME_COLOR = new Float32Array([1, 0, 0, 0]); // identiek → overlap 1.0
const OTHER_COLOR = new Float32Array([0, 0, 0, 1]); // geen overlap → 0.0

describe('findDuplicatePairs', () => {
  it('koppelt sterk gelijkende items met overlappende maat én kleur', () => {
    const a = createItem({ size: '68', type: 'romper' });
    const b = createItem({ size: '68', type: 'romper' });
    setEmbedding(a.id, emb(0), SAME_COLOR);
    setEmbedding(b.id, emb(0.05), SAME_COLOR); // cosine ≈ 0.999
    const pairs = findDuplicatePairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBe(Math.min(a.id, b.id));
    expect(pairs[0].score).toBeGreaterThan(0.99);
  });

  it('weigert een hoge-cosine paar met andere kleur (kleur-gate)', () => {
    const a = createItem({ size: '86/92', type: 'romper' });
    const b = createItem({ size: '86/92', type: 'romper' });
    setEmbedding(a.id, emb(0), SAME_COLOR);
    setEmbedding(b.id, emb(0.05), OTHER_COLOR); // visueel ~zelfde vorm, andere kleur
    expect(findDuplicatePairs()).toHaveLength(0);
  });

  it('negeert paren onder de cosine-drempel', () => {
    const a = createItem({ size: '68' });
    const b = createItem({ size: '68' });
    setEmbedding(a.id, emb(0), SAME_COLOR);
    setEmbedding(b.id, emb(1.2), SAME_COLOR); // cosine ≈ 0.36
    expect(findDuplicatePairs()).toHaveLength(0);
  });

  it('vereist maat-overlap (86 ~ 86/92, niet 50)', () => {
    const a = createItem({ size: '86' });
    const b = createItem({ size: '86/92' });
    const c = createItem({ size: '50' });
    setEmbedding(a.id, emb(0), SAME_COLOR);
    setEmbedding(b.id, emb(0.01), SAME_COLOR);
    setEmbedding(c.id, emb(0.01), SAME_COLOR);
    const pairs = findDuplicatePairs();
    expect(pairs).toHaveLength(1); // alleen a~b
    expect(new Set([pairs[0].a, pairs[0].b])).toEqual(
      new Set([Math.min(a.id, b.id), Math.max(a.id, b.id)])
    );
  });

  it('laat afgewezen paren weg', () => {
    const a = createItem({ size: '74' });
    const b = createItem({ size: '74' });
    setEmbedding(a.id, emb(0), SAME_COLOR);
    setEmbedding(b.id, emb(0.02), SAME_COLOR);
    expect(findDuplicatePairs()).toHaveLength(1);
    dismissDuplicate(a.id, b.id);
    expect(findDuplicatePairs()).toHaveLength(0);
  });

  it('rankt gelijk type boven verschillend type', () => {
    const base = createItem({ size: '80', type: 'broek' });
    const sameType = createItem({ size: '80', type: 'broek' });
    const diffType = createItem({ size: '80', type: 'shirt' });
    setEmbedding(base.id, emb(0), SAME_COLOR);
    setEmbedding(diffType.id, emb(0.01), SAME_COLOR); // iets dichterbij
    setEmbedding(sameType.id, emb(0.05), SAME_COLOR); // iets verder, maar zelfde type
    const top = findDuplicatePairs()[0];
    expect(new Set([top.a, top.b])).toEqual(
      new Set([Math.min(base.id, sameType.id), Math.max(base.id, sameType.id)])
    );
  });
});
