import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

vi.hoisted(() => (process.env.WORKER_TAG_RETRY_MS = '0')); // retry zonder echte wachttijd

// AI-tagging + sidecar gemockt zodat de worker zonder netwerk testbaar is
vi.mock('./ai', () => ({ tagImage: vi.fn() }));
vi.mock('./rembg', () => ({
  cutout: vi.fn().mockRejectedValue(new Error('no rembg')) // cutout faalt zacht (zoals zonder sidecar)
}));
import { tagImage } from './ai';
import { createDb, createItem, getItem, setDbForTesting, updateItem, type DB } from './db';
import { savePhoto } from './photos';
import { processOne } from './worker';

let tmp: string;
let db: DB;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bci-worker-'));
  process.env.PHOTOS_DIR = tmp;
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  vi.mocked(tagImage).mockReset();
});

async function itemWithPhoto(): Promise<number> {
  const item = createItem({ size: '68', ai_status: 'processing' });
  const buf = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#0a0' } })
    .jpeg()
    .toBuffer();
  const saved = await savePhoto(item.id, buf, 'jpg');
  updateItem(item.id, { photo_display: saved.dispName });
  return item.id;
}

describe('processOne', () => {
  it('returns false when the queue is empty', async () => {
    expect(await processOne()).toBe(false);
  });

  it('tags a processing item and stores suggestions → suggested', async () => {
    const id = await itemWithPhoto();
    vi.mocked(tagImage).mockResolvedValue({ type: 'broek', color: 'groen' });
    expect(await processOne()).toBe(true);
    const item = getItem(id)!;
    expect(item.ai_status).toBe('suggested');
    expect(JSON.parse(item.ai_suggestions!)).toEqual({ type: 'broek', color: 'groen' });
  });

  it('marks failed when tagging throws twice (after one retry)', async () => {
    const id = await itemWithPhoto();
    vi.mocked(tagImage).mockRejectedValue(new Error('boom'));
    await processOne();
    expect(getItem(id)!.ai_status).toBe('failed');
    expect(tagImage).toHaveBeenCalledTimes(2);
  });

  it('retries once and succeeds on the second attempt', async () => {
    const id = await itemWithPhoto();
    vi.mocked(tagImage)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ type: 'trui', color: 'blauw' });
    await processOne();
    expect(tagImage).toHaveBeenCalledTimes(2);
    const item = getItem(id)!;
    expect(item.ai_status).toBe('suggested');
    expect(JSON.parse(item.ai_suggestions!)).toEqual({ type: 'trui', color: 'blauw' });
  });

  it('finishes a photo-less processing item as done without calling the AI', async () => {
    const item = createItem({ size: '74', ai_status: 'processing' });
    await processOne();
    expect(getItem(item.id)!.ai_status).toBe('done');
    expect(tagImage).not.toHaveBeenCalled();
  });

  it('claims serially (oldest first)', async () => {
    const a = await itemWithPhoto();
    const b = await itemWithPhoto();
    vi.mocked(tagImage).mockResolvedValue({ type: 'x' });
    await processOne();
    // a verwerkt, b nog in de wachtrij
    expect(getItem(a)!.ai_status).toBe('suggested');
    expect(getItem(b)!.ai_status).toBe('processing');
  });
});
