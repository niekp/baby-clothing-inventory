import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bci-photos-'));
  process.env.PHOTOS_DIR = tmp;
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// dynamische import na het zetten van PHOTOS_DIR (baseDir() leest lazily, dus ok)
const { savePhoto, readPhoto, deletePhotos, extForMime, normalizeCutout } = await import('./photos');

async function jpegBuffer(w = 200, h = 200): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } })
    .jpeg()
    .toBuffer();
}

describe('savePhoto', () => {
  it('writes original and a compressed display webp', async () => {
    const buf = await jpegBuffer(2000, 2000); // groter dan DISPLAY_MAX
    const saved = await savePhoto(1, buf, 'jpg');
    expect(saved.origName).toBe('1.jpg');
    expect(saved.dispName).toBe('1.webp');
    expect(existsSync(join(tmp, 'orig', '1.jpg'))).toBe(true);
    expect(existsSync(join(tmp, 'disp', '1.webp'))).toBe(true);

    // display is webp en geschaald naar max 1024
    const meta = await sharp(join(tmp, 'disp', '1.webp')).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(1024);
  });

  it('keeps the original but returns null display on undecodable input', async () => {
    const saved = await savePhoto(2, Buffer.from('not an image'), 'jpg');
    expect(saved.origName).toBe('2.jpg');
    expect(saved.dispName).toBeNull();
    expect(existsSync(join(tmp, 'orig', '2.jpg'))).toBe(true);
    expect(existsSync(join(tmp, 'disp', '2.webp'))).toBe(false);
  });
});

describe('readPhoto', () => {
  it('reads a saved display file with the right content-type', async () => {
    await savePhoto(3, await jpegBuffer(), 'jpg');
    const f = await readPhoto('disp', '3.webp');
    expect(f?.contentType).toBe('image/webp');
    expect((f?.data.length ?? 0) > 0).toBe(true);
  });

  it('rejects invalid variant', async () => {
    expect(await readPhoto('etc', 'passwd')).toBeNull();
  });

  it('rejects path traversal in filename', async () => {
    expect(await readPhoto('orig', '../../etc/passwd')).toBeNull();
    expect(await readPhoto('orig', 'a/b.jpg')).toBeNull();
  });

  it('returns null for a missing file', async () => {
    expect(await readPhoto('disp', '999.webp')).toBeNull();
  });
});

describe('deletePhotos', () => {
  it('removes existing variants and ignores missing ones', async () => {
    await savePhoto(4, await jpegBuffer(), 'jpg');
    await deletePhotos({ photo_orig: '4.jpg', photo_display: '4.webp', cutout_path: '4.png' });
    expect(existsSync(join(tmp, 'orig', '4.jpg'))).toBe(false);
    expect(existsSync(join(tmp, 'disp', '4.webp'))).toBe(false);
  });
});

describe('extForMime', () => {
  it('maps known mimes and falls back to filename ext', () => {
    expect(extForMime('image/jpeg')).toBe('jpg');
    expect(extForMime('image/png')).toBe('png');
    expect(extForMime('image/webp')).toBe('webp');
    expect(extForMime('application/octet-stream', 'foto.HEIC')).toBe('heic');
    expect(extForMime('application/octet-stream', 'noext')).toBe('bin');
  });
});

describe('normalizeCutout', () => {
  // transparant frame met een opaak gekleurd blok op (left,top)
  async function withBlock(W: number, H: number, bw: number, bh: number, left: number, top: number) {
    const block = await sharp({
      create: { width: bw, height: bh, channels: 4, background: { r: 220, g: 20, b: 20, alpha: 1 } }
    })
      .png()
      .toBuffer();
    return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: block, top, left }])
      .png()
      .toBuffer();
  }
  async function alphaBBox(png: Uint8Array) {
    const { data, info } = await sharp(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * channels + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    return { width, height, minX, minY, maxX, maxY };
  }

  it('produceert een vierkant en centreert het kledingstuk', async () => {
    const bb = await alphaBBox(await normalizeCutout(await withBlock(400, 800, 80, 120, 30, 50)));
    expect(bb.width).toBe(1024);
    expect(bb.height).toBe(1024);
    expect(Math.abs(bb.minX - (bb.width - 1 - bb.maxX))).toBeLessThan(4); // horizontaal gecentreerd
    expect(Math.abs(bb.minY - (bb.height - 1 - bb.maxY))).toBeLessThan(4); // verticaal gecentreerd
  });

  it('toont klein en groot kledingstuk even groot (~86% van de tegel)', async () => {
    const small = await alphaBBox(await normalizeCutout(await withBlock(600, 600, 40, 40, 10, 10)));
    const big = await alphaBBox(await normalizeCutout(await withBlock(600, 600, 300, 300, 100, 100)));
    const smallDim = small.maxX - small.minX + 1;
    const bigDim = big.maxX - big.minX + 1;
    expect(smallDim).toBeGreaterThan(1024 * 0.8);
    expect(Math.abs(smallDim - bigDim)).toBeLessThan(8); // even groot, ongeacht bron-grootte
  });

  it('laat een volledig transparante afbeelding ongemoeid', async () => {
    const empty = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .png()
      .toBuffer();
    const out = await normalizeCutout(empty);
    expect(out.length).toBe(empty.length);
  });
});
