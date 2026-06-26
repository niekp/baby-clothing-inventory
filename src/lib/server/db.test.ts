import { beforeEach, describe, expect, it } from 'vitest';
import {
  claimNextCutout,
  claimNextProcessing,
  clearCutoutJob,
  countBySizeType,
  countNotSharp,
  countQueuedCutouts,
  enqueueSharpenAll,
  createChild,
  createFilterset,
  createItem,
  createDb,
  deleteChild,
  deleteFilterset,
  deleteItem,
  enqueueCutout,
  failTagging,
  finishTagging,
  getItem,
  listChildren,
  listFiltersets,
  queryItems,
  setDbForTesting,
  sweepStuckWorking,
  updateChild,
  updateFilterset,
  updateItem,
  type DB
} from './db';

let db: DB;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

describe('item CRUD', () => {
  it('creates with defaults and reads back', () => {
    const it1 = createItem({ size: '68' });
    expect(it1.id).toBeGreaterThan(0);
    expect(it1.size).toBe('68');
    expect(it1.favorite).toBe(0);
    expect(it1.ai_status).toBe('none');
    expect(it1.cutout_status).toBe('none');
    expect(it1.created_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(getItem(it1.id)?.id).toBe(it1.id);
  });

  it('updates only provided fields', () => {
    const i = createItem({ size: '74', type: 'broek' });
    const u = updateItem(i.id, { color: 'blauw', favorite: 1 });
    expect(u?.color).toBe('blauw');
    expect(u?.favorite).toBe(1);
    expect(u?.type).toBe('broek'); // ongewijzigd
  });

  it('ignores unknown fields in patch', () => {
    const i = createItem({ size: '80' });
    const u = updateItem(i.id, { id: 999, size: '86' } as never);
    expect(u?.id).toBe(i.id); // id niet overschreven
    expect(u?.size).toBe('86');
  });

  it('deletes', () => {
    const i = createItem({ size: '50' });
    expect(deleteItem(i.id)).toBe(true);
    expect(getItem(i.id)).toBeUndefined();
    expect(deleteItem(i.id)).toBe(false);
  });
});

describe('queryItems filtering', () => {
  beforeEach(() => {
    createItem({ size: '62', type: 'broek', seasons: ['zomer'], color: 'rood', favorite: 1 });
    createItem({ size: '68', type: 'broek', seasons: ['winter'], color: 'blauw' });
    createItem({ size: '68', type: 'jurk', seasons: ['zomer'], color: 'rood' });
  });

  it('no filters returns all', () => {
    expect(queryItems().length).toBe(3);
  });

  it('multi-value size filter (IN)', () => {
    expect(queryItems({ size: ['62', '68'] }).length).toBe(3);
    expect(queryItems({ size: ['62'] }).length).toBe(1);
  });

  it('dubbele maat telt voor beide componenten', () => {
    createItem({ size: '86/92', type: 'romper' });
    expect(queryItems({ size: ['86'] }).map((i) => i.size)).toEqual(['86/92']); // 86 → ook 86/92
    expect(queryItems({ size: ['92'] }).map((i) => i.size)).toEqual(['86/92']); // 92 → ook 86/92
    expect(queryItems({ size: ['68'] }).length).toBe(2); // 86/92 telt NIET mee bij 68
  });

  it('combines filters with AND', () => {
    const r = queryItems({ size: ['68'], type: ['broek'] });
    expect(r.length).toBe(1);
    expect(r[0].season).toBe('["winter"]'); // opgeslagen als JSON-array
  });

  it('favorite-only', () => {
    expect(queryItems({ favorite: true }).length).toBe(1);
  });

  it('free search matches color/type/note', () => {
    expect(queryItems({ search: 'rood' }).length).toBe(2);
    expect(queryItems({ search: 'jurk' }).length).toBe(1);
  });

  it('sort by size ascending numerically', () => {
    const r = queryItems({ sort: 'size' });
    expect(r.map((x) => x.size)).toEqual(['62', '68', '68']);
  });

  it('season filter matches items whose list contains the season', () => {
    expect(queryItems({ season: ['zomer'] }).length).toBe(2); // de twee zomer-items
    expect(queryItems({ season: ['winter'] }).length).toBe(1);
    expect(queryItems({ season: ['zomer', 'winter'] }).length).toBe(3); // beide
  });
});

describe('multi-season storage + allseason filter', () => {
  it('stores multiple seasons and matches any of them', () => {
    const i = createItem({ size: '74', seasons: ['zomer', 'tussenseizoen'] });
    expect(JSON.parse(getItem(i.id)!.season!)).toEqual(['zomer', 'tussenseizoen']);
    expect(queryItems({ season: ['tussenseizoen'] }).map((x) => x.id)).toContain(i.id);
    expect(queryItems({ season: ['winter'] }).map((x) => x.id)).not.toContain(i.id);
  });

  it('an allseason item surfaces under any specific-season filter', () => {
    const all = createItem({ size: '80', seasons: ['allseason'] });
    expect(queryItems({ season: ['winter'] }).map((x) => x.id)).toContain(all.id);
    expect(queryItems({ season: ['zomer'] }).map((x) => x.id)).toContain(all.id);
  });

  it('item without seasons does not match a season filter', () => {
    const none = createItem({ size: '86' });
    expect(queryItems({ season: ['zomer'] }).map((x) => x.id)).not.toContain(none.id);
  });
});

describe('worker claim/sweep', () => {
  it('claims oldest processing item atomically and flips to working', () => {
    const a = createItem({ size: '62', ai_status: 'processing' });
    createItem({ size: '68', ai_status: 'processing' });
    const claimed = claimNextProcessing();
    expect(claimed?.id).toBe(a.id);
    expect(claimed?.ai_status).toBe('working');
    expect(getItem(a.id)?.ai_status).toBe('working');
  });

  it('returns undefined when nothing to claim', () => {
    createItem({ size: '62', ai_status: 'done' });
    expect(claimNextProcessing()).toBeUndefined();
  });

  it('sweep resets working back to processing', () => {
    const a = createItem({ size: '62', ai_status: 'processing' });
    claimNextProcessing();
    expect(getItem(a.id)?.ai_status).toBe('working');
    expect(sweepStuckWorking()).toBe(1);
    expect(getItem(a.id)?.ai_status).toBe('processing');
  });

  it('finishTagging only writes while the item is still working (no clobber of handwerk)', () => {
    const a = createItem({ size: '62', ai_status: 'processing' });
    claimNextProcessing(); // → working
    expect(finishTagging(a.id, '{"type":"broek"}')).toBe(true);
    expect(getItem(a.id)?.ai_status).toBe('suggested');

    // gebruiker handelt 't handmatig af; een latere worker-write mag niet clobberen
    const b = createItem({ size: '68', ai_status: 'processing' });
    claimNextProcessing(); // claimt b → working
    updateItem(b.id, { ai_status: 'done' }); // gebruiker wint
    expect(finishTagging(b.id, '{"type":"jurk"}')).toBe(false);
    expect(getItem(b.id)?.ai_status).toBe('done'); // niet teruggezet naar suggested
  });

  it('failTagging only flips a working item', () => {
    const a = createItem({ size: '62', ai_status: 'done' });
    expect(failTagging(a.id)).toBe(false); // niet working → genegeerd
    expect(getItem(a.id)?.ai_status).toBe('done');
  });
});

describe('countBySizeType', () => {
  it('aggregates counts', () => {
    createItem({ size: '68', type: 'broek' });
    createItem({ size: '68', type: 'broek' });
    createItem({ size: '68', type: 'jurk' });
    const rows = countBySizeType();
    const broek = rows.find((r) => r.size === '68' && r.type === 'broek');
    expect(broek?.n).toBe(2);
  });
});

describe('filterset CRUD', () => {
  it('creates, pins (sort), updates, lists', () => {
    createFilterset('maat 56 zomer', '{"size":["56"]}', 0);
    createFilterset('favorieten', '{"favorite":true}', 1);
    const list = listFiltersets();
    expect(list.length).toBe(2);
    expect(list[0].pinned).toBe(1); // pinned eerst
    const updated = updateFilterset(list[1].id, { pinned: 1 });
    expect(updated?.pinned).toBe(1);
  });

  it('does not let a stray id in patch retarget the row', () => {
    const a = createFilterset('a', '{}', 0);
    const b = createFilterset('b', '{}', 0);
    updateFilterset(a.id, { name: 'a2', id: b.id } as never);
    expect(listFiltersets().find((f) => f.id === a.id)?.name).toBe('a2');
    expect(listFiltersets().find((f) => f.id === b.id)?.name).toBe('b'); // ongewijzigd
  });

  it('deletes', () => {
    const f = createFilterset('x', '{}', 0);
    expect(deleteFilterset(f.id)).toBe(true);
    expect(listFiltersets().length).toBe(0);
  });
});

describe('child CRUD', () => {
  it('creates, updates, lists meerdere maten', () => {
    const c = createChild('Kind A', ['68']);
    expect(c.current_sizes).toEqual(['68']);
    updateChild(c.id, { current_sizes: ['74', '80'] });
    expect(listChildren()[0].current_sizes).toEqual(['74', '80']);
  });

  it('defaultt naar een lege lijst en kan weer geleegd worden', () => {
    const c = createChild('Leeg');
    expect(c.current_sizes).toEqual([]);
    updateChild(c.id, { current_sizes: ['62'] });
    updateChild(c.id, { current_sizes: [] });
    expect(listChildren()[0].current_sizes).toEqual([]);
  });

  it('does not let a stray id in patch retarget the row', () => {
    const a = createChild('A', ['50']);
    const b = createChild('B', ['56']);
    updateChild(a.id, { name: 'A2', id: b.id } as never);
    expect(listChildren().find((c) => c.id === a.id)?.name).toBe('A2');
    expect(listChildren().find((c) => c.id === b.id)?.name).toBe('B');
  });

  it('deletes', () => {
    const c = createChild('Z');
    expect(deleteChild(c.id)).toBe(true);
    expect(listChildren().length).toBe(0);
  });
});

describe('cutout-wachtrij (cutout_job)', () => {
  it('enqueue → claim tilt queued naar working en geeft het model terug', () => {
    const a = createItem({ size: '74' });
    enqueueCutout(a.id, 'birefnet-general');
    expect(getItem(a.id)!.cutout_job).toBe('queued:birefnet-general');
    const job = claimNextCutout();
    expect(job).toEqual({ id: a.id, model: 'birefnet-general' });
    expect(getItem(a.id)!.cutout_job).toBe('working:birefnet-general');
    expect(claimNextCutout()).toBeUndefined(); // niets meer queued
  });

  it('leeg model → default (claim geeft lege string)', () => {
    const a = createItem({ size: '74' });
    enqueueCutout(a.id);
    expect(getItem(a.id)!.cutout_job).toBe('queued:');
    expect(claimNextCutout()).toEqual({ id: a.id, model: '' });
  });

  it('claim is FIFO op created_at', () => {
    const a = createItem({ size: '74' });
    const b = createItem({ size: '80' });
    enqueueCutout(b.id);
    enqueueCutout(a.id);
    expect(claimNextCutout()!.id).toBe(a.id); // a is ouder
  });

  it('clearCutoutJob haalt het uit de wachtrij', () => {
    const a = createItem({ size: '74' });
    enqueueCutout(a.id, 'birefnet-general');
    claimNextCutout();
    clearCutoutJob(a.id);
    expect(getItem(a.id)!.cutout_job).toBeNull();
  });

  it('sweepStuckWorking zet working terug naar queued (model behouden)', () => {
    const a = createItem({ size: '74' });
    enqueueCutout(a.id, 'birefnet-general');
    claimNextCutout(); // → working:birefnet-general
    sweepStuckWorking();
    expect(getItem(a.id)!.cutout_job).toBe('queued:birefnet-general');
  });
});

describe('cutout_model + verbeter-alles', () => {
  const withPhoto = (size: string) => {
    const it = createItem({ size });
    updateItem(it.id, { photo_display: `${it.id}.webp` });
    return it;
  };

  it('countNotSharp telt items zonder/met niet-birefnet model, negeert foto-loze', () => {
    const a = withPhoto('74'); // cutout_model NULL → niet-scherp
    const b = withPhoto('80');
    updateItem(b.id, { cutout_model: 'isnet-general-use' }); // niet-scherp
    const c = withPhoto('86');
    updateItem(c.id, { cutout_model: 'birefnet-general' }); // scherp
    createItem({ size: '92' }); // geen foto → telt niet
    expect(countNotSharp()).toBe(2);
    expect([a.id, b.id, c.id].length).toBe(3);
  });

  it('enqueueSharpenAll zet alleen niet-scherpe foto-items in de birefnet-queue', () => {
    const a = withPhoto('74');
    const b = withPhoto('80');
    updateItem(b.id, { cutout_model: 'birefnet-general' }); // al scherp → overslaan
    const n = enqueueSharpenAll();
    expect(n).toBe(1);
    expect(getItem(a.id)!.cutout_job).toBe('queued:birefnet-general');
    expect(getItem(b.id)!.cutout_job).toBeNull();
  });

  it('enqueueSharpenAll slaat items met een lopende job over', () => {
    const a = withPhoto('74');
    enqueueCutout(a.id, 'isnet-general-use'); // al in de wachtrij
    expect(enqueueSharpenAll()).toBe(0);
    expect(getItem(a.id)!.cutout_job).toBe('queued:isnet-general-use'); // niet overschreven
  });

  it('countQueuedCutouts telt lopende+wachtende jobs', () => {
    const a = withPhoto('74');
    const b = withPhoto('80');
    enqueueCutout(a.id, 'birefnet-general');
    expect(countQueuedCutouts()).toBe(1);
    enqueueCutout(b.id);
    expect(countQueuedCutouts()).toBe(2);
  });

  it('generateCutout-pad: done-update legt cutout_model vast (via updateItem-whitelist)', () => {
    const a = withPhoto('74');
    updateItem(a.id, { cutout_status: 'done', cutout_model: 'birefnet-general' });
    expect(getItem(a.id)!.cutout_model).toBe('birefnet-general');
    expect(countNotSharp()).toBe(0);
  });
});

describe('ai_status CHECK constraint', () => {
  it('rejects an invalid status', () => {
    const i = createItem({ size: '68' });
    expect(() => db.prepare("UPDATE item SET ai_status='bogus' WHERE id=?").run(i.id)).toThrow();
  });
});

describe('foreign key cascade', () => {
  it('deleting an item cascades to outfit_item', () => {
    const item = createItem({ size: '68' });
    db.prepare("INSERT INTO outfit (name, created_at) VALUES ('o', '2026-01-01')").run();
    const outfitId = db.prepare('SELECT id FROM outfit').get() as { id: number };
    db.prepare('INSERT INTO outfit_item (outfit_id, item_id) VALUES (?, ?)').run(
      outfitId.id,
      item.id
    );
    expect((db.prepare('SELECT COUNT(*) AS n FROM outfit_item').get() as { n: number }).n).toBe(1);
    deleteItem(item.id);
    expect((db.prepare('SELECT COUNT(*) AS n FROM outfit_item').get() as { n: number }).n).toBe(0);
  });
});
