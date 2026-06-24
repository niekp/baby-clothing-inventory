import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, createItem, deleteItem, setDbForTesting, type DB } from './db';
import {
  createOutfit,
  deleteOutfit,
  getOutfitWithItems,
  listOutfits,
  updateOutfit
} from './outfits';

let db: DB;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

function seedItems(n: number): number[] {
  return Array.from({ length: n }, (_, i) => createItem({ size: '68', type: `t${i}` }).id);
}

describe('outfit CRUD', () => {
  it('creates an outfit with layout items', () => {
    const [a, b] = seedItems(2);
    const o = createOutfit('Zomerlook', [
      { item_id: a, x: 10, y: 20, scale: 1.5, rotation: 0, z_index: 0 },
      { item_id: b, x: 30, y: 40, scale: 1, rotation: 15, z_index: 1 }
    ]);
    expect(o.id).toBeGreaterThan(0);
    expect(o.name).toBe('Zomerlook');

    const full = getOutfitWithItems(o.id)!;
    expect(full.items.length).toBe(2);
    expect(full.items[0].item_id).toBe(a);
    expect(full.items[0].scale).toBe(1.5);
    expect(full.items[0].item.id).toBe(a); // joined item
    expect(full.items[1].rotation).toBe(15);
  });

  it('orders items by z_index', () => {
    const [a, b] = seedItems(2);
    const o = createOutfit('x', [
      { item_id: a, x: 0, y: 0, scale: 1, rotation: 0, z_index: 5 },
      { item_id: b, x: 0, y: 0, scale: 1, rotation: 0, z_index: 1 }
    ]);
    const full = getOutfitWithItems(o.id)!;
    expect(full.items.map((i) => i.item_id)).toEqual([b, a]); // z_index 1 voor 5
  });

  it('PATCH replaces the item layout', () => {
    const [a, b, c] = seedItems(3);
    const o = createOutfit('x', [{ item_id: a, x: 0, y: 0, scale: 1, rotation: 0, z_index: 0 }]);
    updateOutfit(o.id, {
      name: 'y',
      items: [
        { item_id: b, x: 1, y: 1, scale: 1, rotation: 0, z_index: 0 },
        { item_id: c, x: 2, y: 2, scale: 1, rotation: 0, z_index: 1 }
      ]
    });
    const full = getOutfitWithItems(o.id)!;
    expect(full.outfit.name).toBe('y');
    expect(full.items.map((i) => i.item_id)).toEqual([b, c]); // a vervangen
  });

  it('deletes an outfit', () => {
    const [a] = seedItems(1);
    const o = createOutfit('x', [{ item_id: a, x: 0, y: 0, scale: 1, rotation: 0, z_index: 0 }]);
    expect(deleteOutfit(o.id)).toBe(true);
    expect(listOutfits().length).toBe(0);
    expect(getOutfitWithItems(o.id)).toBeUndefined();
    // outfit_item moet meegecascade zijn
    expect((db.prepare('SELECT COUNT(*) AS n FROM outfit_item').get() as { n: number }).n).toBe(0);
  });

  it('deleting an item cascades it out of the outfit layout', () => {
    const [a, b] = seedItems(2);
    const o = createOutfit('x', [
      { item_id: a, x: 0, y: 0, scale: 1, rotation: 0, z_index: 0 },
      { item_id: b, x: 0, y: 0, scale: 1, rotation: 0, z_index: 1 }
    ]);
    deleteItem(a);
    const full = getOutfitWithItems(o.id)!;
    expect(full.items.map((i) => i.item_id)).toEqual([b]); // a weg, outfit blijft
  });
});
