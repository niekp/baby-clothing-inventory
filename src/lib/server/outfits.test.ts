import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimNextOutfitCutout,
  clearOutfitCutoutJob,
  countNotSharp,
  countQueuedCutouts,
  createDb,
  createItem,
  deleteItem,
  enqueueOutfitCutout,
  enqueueSharpenAll,
  setDbForTesting,
  setOutfitCutoutResult,
  sweepStuckWorking,
  type DB
} from './db';
import {
  createOutfit,
  deleteOutfit,
  getOutfit,
  getOutfitWithItems,
  listOutfits,
  listOutfitSizes,
  setOutfitPhotoOrig,
  updateOutfit
} from './outfits';
import { parseOutfitSize } from './outfit-validate';

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

describe('outfit size', () => {
  it('creates an outfit without a size (optional)', () => {
    const o = createOutfit('x', []);
    expect(o.size).toBeNull();
  });

  it('creates an outfit with a size', () => {
    const o = createOutfit('x', [], '68');
    expect(o.size).toBe('68');
  });

  it('PATCH sets and clears the size', () => {
    const o = createOutfit('x', [], '68');
    expect(updateOutfit(o.id, { size: '74' })!.size).toBe('74');
    expect(updateOutfit(o.id, { size: null })!.size).toBeNull();
  });

  it('PATCH without size does not touch the stored size', () => {
    const o = createOutfit('x', [], '86');
    updateOutfit(o.id, { name: 'y' }); // size niet meegestuurd
    expect(getOutfit(o.id)!.size).toBe('86');
  });

  it('filters outfits by size, matching double sizes and excluding sizeless', () => {
    createOutfit('a', [], '86');
    createOutfit('b', [], '86/92');
    createOutfit('c', [], '56');
    createOutfit('d', []); // geen maat
    const names = (sizes: string[]) => listOutfits(sizes).map((o) => o.name).sort();
    expect(names(['86'])).toEqual(['a', 'b']); // 86 matcht ook 86/92, niet 56/maatloos
    expect(names(['56'])).toEqual(['c']);
    expect(listOutfits().map((o) => o.name).sort()).toEqual(['a', 'b', 'c', 'd']); // geen filter
  });

  it('listOutfitSizes returns distinct present sizes in chip order', () => {
    createOutfit('a', [], '86');
    createOutfit('b', [], '56');
    createOutfit('c', [], '86'); // dubbel → distinct
    createOutfit('d', []); // geen maat telt niet mee
    expect(listOutfitSizes()).toEqual(['56', '86']); // SIZE_CHIPS-volgorde
  });

  it('parseOutfitSize keeps valid sizes, empty→null, invalid→400', () => {
    expect(parseOutfitSize('68')).toBe('68'); // enkel
    expect(parseOutfitSize('86/92')).toBe('86/92'); // dubbel
    expect(parseOutfitSize('')).toBeNull(); // leeg → geen maat
    expect(parseOutfitSize(undefined)).toBeNull();
    expect(parseOutfitSize(null)).toBeNull();
    expect(() => parseOutfitSize('999')).toThrow(); // ongeldige niet-lege → 400
    expect(() => parseOutfitSize(42)).toThrow();
  });
});

describe('outfit cutout queue', () => {
  it('enqueue → claim (atomic queued→working) → clear', () => {
    const o = createOutfit('x', []);
    enqueueOutfitCutout(o.id); // leeg model = isnet
    expect(getOutfit(o.id)!.cutout_job).toBe('queued:');

    const job = claimNextOutfitCutout()!;
    expect(job.id).toBe(o.id);
    expect(job.model).toBe(''); // default
    expect(getOutfit(o.id)!.cutout_job).toBe('working:');
    expect(claimNextOutfitCutout()).toBeUndefined(); // niets meer te claimen

    clearOutfitCutoutJob(o.id);
    expect(getOutfit(o.id)!.cutout_job).toBeNull();
  });

  it('claim carries the explicit model', () => {
    const o = createOutfit('x', []);
    enqueueOutfitCutout(o.id, 'birefnet-general');
    expect(claimNextOutfitCutout()!.model).toBe('birefnet-general');
  });

  it('setOutfitCutoutResult writes status/model/thumb, no-op when gone', () => {
    const o = createOutfit('x', []);
    setOutfitCutoutResult(o.id, {
      cutout_status: 'done',
      cutout_model: 'isnet-general-use',
      thumb_path: `${o.id}.png`
    });
    const row = getOutfit(o.id)!;
    expect(row.cutout_status).toBe('done');
    expect(row.cutout_model).toBe('isnet-general-use');
    expect(row.thumb_path).toBe(`${o.id}.png`);
    // verwijderd → setter is een no-op (geen throw)
    deleteOutfit(o.id);
    expect(() => setOutfitCutoutResult(o.id, { cutout_status: 'done' })).not.toThrow();
    expect(getOutfit(o.id)).toBeUndefined();
  });

  it('sweepStuckWorking requeues stuck outfit cutout jobs', () => {
    const o = createOutfit('x', []);
    enqueueOutfitCutout(o.id, 'birefnet-general');
    claimNextOutfitCutout(); // → working:birefnet-general
    expect(getOutfit(o.id)!.cutout_job).toBe('working:birefnet-general');
    sweepStuckWorking();
    expect(getOutfit(o.id)!.cutout_job).toBe('queued:birefnet-general');
  });
});

describe('bulk sharpen covers foto-outfits', () => {
  // maakt een foto-outfit met een gegeven cutout_model (null = niet-scherp)
  function photoOutfit(model: string | null): number {
    const o = createOutfit('look', []);
    setOutfitPhotoOrig(o.id, `${o.id}.jpg`);
    if (model) setOutfitCutoutResult(o.id, { cutout_status: 'done', cutout_model: model });
    return o.id;
  }

  it('countNotSharp telt niet-scherpe foto-outfits mee, niet de scherpe of item-outfits', () => {
    photoOutfit(null); // niet-scherp foto-outfit → telt
    photoOutfit('birefnet-general'); // al scherp → telt niet
    createOutfit('sleep', []); // item-outfit (geen photo_orig) → telt niet
    expect(countNotSharp()).toBe(1);
  });

  it('enqueueSharpenAll zet niet-scherpe foto-outfits in de birefnet-queue', () => {
    const notSharp = photoOutfit(null);
    const sharp = photoOutfit('birefnet-general');
    const n = enqueueSharpenAll();
    expect(n).toBe(1);
    expect(getOutfit(notSharp)!.cutout_job).toBe('queued:birefnet-general');
    expect(getOutfit(sharp)!.cutout_job).toBeNull(); // al scherp → niet aangeraakt
    expect(countQueuedCutouts()).toBe(1);
  });
});
