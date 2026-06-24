import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, createItem, dismissDuplicate, setEmbedding, setDbForTesting, type DB } from './db';
import { findDuplicatePairs } from './duplicates';

let db: DB;
beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

// genormaliseerde 2D-vector onder hoek θ
function vec(theta: number): Float32Array {
  return new Float32Array([Math.cos(theta), Math.sin(theta)]);
}

describe('findDuplicatePairs', () => {
  it('koppelt sterk gelijkende items met overlappende maat', () => {
    const a = createItem({ size: '68', type: 'romper' });
    const b = createItem({ size: '68', type: 'romper' });
    setEmbedding(a.id, vec(0));
    setEmbedding(b.id, vec(0.05)); // cosine ≈ 0.999
    const pairs = findDuplicatePairs();
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a).toBe(Math.min(a.id, b.id));
    expect(pairs[0].score).toBeGreaterThan(0.99);
  });

  it('negeert paren onder de drempel', () => {
    const a = createItem({ size: '68' });
    const b = createItem({ size: '68' });
    setEmbedding(a.id, vec(0));
    setEmbedding(b.id, vec(1.2)); // cosine ≈ 0.36
    expect(findDuplicatePairs()).toHaveLength(0);
  });

  it('vereist maat-overlap (86 ~ 86/92, niet 50)', () => {
    const a = createItem({ size: '86' });
    const b = createItem({ size: '86/92' });
    const c = createItem({ size: '50' });
    setEmbedding(a.id, vec(0));
    setEmbedding(b.id, vec(0.01));
    setEmbedding(c.id, vec(0.01));
    const pairs = findDuplicatePairs();
    expect(pairs).toHaveLength(1); // alleen a~b
    expect(new Set([pairs[0].a, pairs[0].b])).toEqual(new Set([Math.min(a.id, b.id), Math.max(a.id, b.id)]));
  });

  it('laat afgewezen paren weg', () => {
    const a = createItem({ size: '74' });
    const b = createItem({ size: '74' });
    setEmbedding(a.id, vec(0));
    setEmbedding(b.id, vec(0.02));
    expect(findDuplicatePairs()).toHaveLength(1);
    dismissDuplicate(a.id, b.id);
    expect(findDuplicatePairs()).toHaveLength(0);
  });

  it('rankt gelijk type boven verschillend type', () => {
    const base = createItem({ size: '80', type: 'broek' });
    const sameType = createItem({ size: '80', type: 'broek' });
    const diffType = createItem({ size: '80', type: 'shirt' });
    setEmbedding(base.id, vec(0));
    setEmbedding(diffType.id, vec(0.01)); // iets dichterbij
    setEmbedding(sameType.id, vec(0.05)); // iets verder, maar zelfde type
    const pairs = findDuplicatePairs();
    // het gelijk-type paar (base~sameType) moet bovenaan staan
    const top = pairs[0];
    expect(new Set([top.a, top.b])).toEqual(
      new Set([Math.min(base.id, sameType.id), Math.max(base.id, sameType.id)])
    );
  });
});
