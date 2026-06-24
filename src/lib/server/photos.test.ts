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
const { savePhoto, readPhoto, deletePhotos, extForMime } = await import('./photos');

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
