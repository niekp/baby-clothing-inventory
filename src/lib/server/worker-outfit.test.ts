import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

vi.mock('./ai', () => ({ tagImage: vi.fn() }));
vi.mock('./rembg', () => ({ cutout: vi.fn() }));
import { cutout } from './rembg';
import { createDb, enqueueOutfitCutout, setDbForTesting, type DB } from './db';
import { createOutfit, deleteOutfit, getOutfit } from './outfits';
import { saveOutfitOrig } from './photos';
import { drainOutfitCutout } from './worker';

let tmp: string;
let db: DB;
const dirs: string[] = [];

beforeEach(() => {
  // verse fotomap per test: outfit-id's resetten naar 1 per :memory:-db, dus
  // gedeelde bestanden zouden anders over tests heen lekken.
  tmp = mkdtempSync(join(tmpdir(), 'bci-outfit-worker-'));
  dirs.push(tmp);
  process.env.PHOTOS_DIR = tmp;
  db = createDb(':memory:');
  setDbForTesting(db);
  vi.mocked(cutout).mockReset();
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

// transparant kader met een opaak blok, zodat normalizeOutfitCutout alpha vindt
async function cutoutPng(): Promise<Uint8Array<ArrayBuffer>> {
  const block = await sharp({
    create: { width: 60, height: 120, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const buf = await sharp({
    create: { width: 200, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: block, top: 40, left: 40 }])
    .png()
    .toBuffer();
  return new Uint8Array(buf) as Uint8Array<ArrayBuffer>;
}

// echte (kleine) jpeg-bron zodat de worker-resize (sharp) 'm kan lezen
async function srcJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 300, height: 500, channels: 3, background: '#246' } })
    .jpeg()
    .toBuffer();
}

// foto-outfit met een bronbestand op schijf
async function photoOutfit(): Promise<number> {
  const o = createOutfit('look', []);
  await saveOutfitOrig(o.id, await srcJpeg(), 'jpg');
  db.prepare('UPDATE outfit SET photo_orig = ? WHERE id = ?').run(`${o.id}.jpg`, o.id);
  enqueueOutfitCutout(o.id); // isnet
  return o.id;
}

describe('drainOutfitCutout — twee-traps', () => {
  it('isnet-cutout → done, en enqueuet automatisch birefnet (geen clobber)', async () => {
    const id = await photoOutfit();
    vi.mocked(cutout).mockResolvedValue(await cutoutPng());

    expect(await drainOutfitCutout()).toBe(true);
    const row = getOutfit(id)!;
    expect(row.cutout_status).toBe('done');
    expect(row.cutout_model).toBe('isnet-general-use');
    expect(row.thumb_path).toBe(`${id}.png`);
    // clobber-race: de follow-job moet ná de clear zijn gezet
    expect(row.cutout_job).toBe('queued:birefnet-general');
    expect(existsSync(join(tmp, 'outfit', `${id}.png`))).toBe(true);
    expect(existsSync(join(tmp, 'outfit', `${id}.webp`))).toBe(true);
  });

  it('tweede drain (birefnet) → scherp, geen verdere job', async () => {
    const id = await photoOutfit();
    vi.mocked(cutout).mockResolvedValue(await cutoutPng());
    await drainOutfitCutout(); // isnet → queued:birefnet-general
    expect(await drainOutfitCutout()).toBe(true); // birefnet
    const row = getOutfit(id)!;
    expect(row.cutout_model).toBe('birefnet-general');
    expect(row.cutout_job).toBeNull(); // geen verdere follow
  });

  it('mislukte cutout → failed, geen birefnet-follow', async () => {
    const id = await photoOutfit();
    vi.mocked(cutout).mockRejectedValue(new Error('no rembg'));
    await drainOutfitCutout();
    const row = getOutfit(id)!;
    expect(row.cutout_status).toBe('failed');
    expect(row.cutout_job).toBeNull();
  });

  it('delete-race: outfit weg tijdens cutout → geen wees-cutout', async () => {
    const id = await photoOutfit();
    // cutout slaagt, maar de outfit wordt ondertussen verwijderd
    vi.mocked(cutout).mockImplementationOnce(async () => {
      deleteOutfit(id);
      return cutoutPng();
    });
    await drainOutfitCutout();
    expect(getOutfit(id)).toBeUndefined();
    expect(existsSync(join(tmp, 'outfit', `${id}.png`))).toBe(false); // geen wees-bestand
  });

  it('returns false when the outfit cutout queue is empty', async () => {
    expect(await drainOutfitCutout()).toBe(false);
  });
});
