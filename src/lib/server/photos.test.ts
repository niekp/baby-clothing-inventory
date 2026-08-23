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
const {
  savePhoto,
  readPhoto,
  deletePhotos,
  extForMime,
  isSupportedImageMime,
  normalizeCutout,
  normalizeOutfitCutout,
  saveOutfitOrig,
  saveOutfitThumb,
  saveOutfitCutoutThumb,
  deleteOutfitPhotos,
  deleteOutfitThumb
} = await import('./photos');

async function jpegBuffer(w = 200, h = 200): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: '#c33' } })
    .jpeg()
    .toBuffer();
}

describe('mime-herkenning', () => {
  it('herkent de ondersteunde mimes, met of zonder parameters', () => {
    expect(isSupportedImageMime('image/jpeg')).toBe(true);
    expect(isSupportedImageMime('image/png')).toBe(true);
    expect(isSupportedImageMime('image/webp')).toBe(true);
    expect(isSupportedImageMime('IMAGE/JPEG')).toBe(true);
    expect(isSupportedImageMime('image/jpeg;charset=utf-8')).toBe(true);
  });

  it('wijst niet-ondersteunde mimes en prototype-sleutels af', () => {
    for (const mime of ['image/heic', 'application/pdf', '', '__proto__', 'constructor']) {
      expect(isSupportedImageMime(mime)).toBe(false);
    }
  });

  it('extForMime valt op de bestandsnaam terug bij een prototype-sleutel', () => {
    expect(extForMime('constructor', 'foto.jpg')).toBe('jpg');
    expect(extForMime('__proto__', 'foto.png')).toBe('png');
    expect(extForMime('image/jpeg;charset=utf-8')).toBe('jpg');
  });
});

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

describe('normalizeOutfitCutout', () => {
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

  it('behoudt de aspect (staande input → geen geforceerd vierkant)', async () => {
    // staand blok 80x300 op een groter kader
    const out = await normalizeOutfitCutout(await withBlock(600, 800, 80, 300, 100, 100));
    const meta = await sharp(out).metadata();
    // hoogte duidelijk groter dan breedte → aspect behouden, niet 1:1
    expect((meta.height ?? 0) / (meta.width ?? 1)).toBeGreaterThan(2);
    // bijgesneden tot ~bbox + marge, dus veel kleiner dan het bronkader
    expect(meta.width).toBeLessThan(200);
  });

  it('laat een volledig transparante afbeelding ongemoeid', async () => {
    const empty = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .png()
      .toBuffer();
    const out = await normalizeOutfitCutout(empty);
    expect(out.length).toBe(empty.length);
  });
});

describe('outfit photo files', () => {
  async function pngBlock() {
    return sharp({ create: { width: 64, height: 96, channels: 4, background: { r: 10, g: 200, b: 10, alpha: 1 } } })
      .png()
      .toBuffer();
  }

  it('saveOutfitOrig writes to outfit_orig and readPhoto reads it back', async () => {
    await saveOutfitOrig(7, await jpegBuffer(), 'jpg');
    expect(existsSync(join(tmp, 'outfit_orig', '7.jpg'))).toBe(true);
    const f = await readPhoto('outfit_orig', '7.jpg');
    expect(f?.contentType).toBe('image/jpeg');
    expect((f?.data.length ?? 0) > 0).toBe(true);
  });

  it('cutout PNG + webp thumb land in the outfit variant (no item id collision)', async () => {
    const png = await pngBlock();
    await saveOutfitThumb(7, png);
    await saveOutfitCutoutThumb(7, png);
    expect(existsSync(join(tmp, 'outfit', '7.png'))).toBe(true);
    expect(existsSync(join(tmp, 'outfit', '7.webp'))).toBe(true);
    // aparte map van item-cutouts → geen botsing met cutout/7.png
    expect(existsSync(join(tmp, 'cutout', '7.png'))).toBe(false);
  });

  it('deleteOutfitPhotos removes source, cutout PNG and webp thumb', async () => {
    await saveOutfitOrig(8, await jpegBuffer(), 'jpg');
    await saveOutfitThumb(8, await pngBlock());
    await saveOutfitCutoutThumb(8, await pngBlock());
    await deleteOutfitPhotos(8, { photo_orig: '8.jpg' });
    expect(existsSync(join(tmp, 'outfit_orig', '8.jpg'))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', '8.png'))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', '8.webp'))).toBe(false);
  });

  // crash tussen het schrijven van de cutout en het zetten van thumb_path
  it('deleteOutfitPhotos ruimt de cutout ook op als thumb_path nooit gezet is', async () => {
    await saveOutfitOrig(9, await jpegBuffer(), 'jpg');
    await saveOutfitThumb(9, await pngBlock());
    await saveOutfitCutoutThumb(9, await pngBlock());
    await deleteOutfitPhotos(9, { photo_orig: null });
    expect(existsSync(join(tmp, 'outfit', '9.png'))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', '9.webp'))).toBe(false);
  });

  it('deleteOutfitThumb verwijdert de item-outfit-thumb', async () => {
    await saveOutfitThumb(10, await pngBlock());
    await deleteOutfitThumb(10);
    expect(existsSync(join(tmp, 'outfit', '10.png'))).toBe(false);
  });
});
