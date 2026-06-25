import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Variant = 'orig' | 'disp' | 'cutout' | 'thumb' | 'outfit';
const VARIANTS: Variant[] = ['orig', 'disp', 'cutout', 'thumb', 'outfit'];

const DISPLAY_MAX = 1024;
const DISPLAY_QUALITY = 80;
const THUMB_MAX = 384; // kleine transparante thumbnail voor grids/lijsten
const THUMB_QUALITY = 78;

function baseDir(): string {
  return process.env.PHOTOS_DIR ?? 'data/photos';
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

const ensured = new Set<string>();
function ensureDirs(): void {
  const b = baseDir();
  if (ensured.has(b)) return;
  for (const v of VARIANTS) mkdirSync(join(b, v), { recursive: true });
  ensured.add(b);
}

export function extForMime(mime: string, fallbackName = ''): string {
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  const m = fallbackName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : 'bin';
}

function mimeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

export interface SavedPhoto {
  origName: string; // <id>.<ext>
  dispName: string | null; // <id>.webp, of null als compressie faalde
}

// Schrijft origineel + (best-effort) display-webp. Bij sharp-fout: origineel
// blijft staan, display = null (item blijft bruikbaar, ai_status door caller op 'none').
export async function savePhoto(id: number, buffer: Buffer, ext: string): Promise<SavedPhoto> {
  ensureDirs();
  const origName = `${id}.${ext}`;
  await writeFile(join(baseDir(), 'orig', origName), buffer);

  const dispName = `${id}.webp`;
  try {
    await sharp(buffer)
      .rotate() // honor EXIF orientation
      .resize(DISPLAY_MAX, DISPLAY_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: DISPLAY_QUALITY })
      .toFile(join(baseDir(), 'disp', dispName));
    return { origName, dispName };
  } catch {
    return { origName, dispName: null };
  }
}

// Witte rand vóór rembg: voorkomt dat kleding die de fotorand raakt (mouwen e.d.)
// als achtergrond wordt weggesneden. normalizeCutout cropt de rand daarna weg.
const CUTOUT_PAD = 0.08;
export async function padForCutout(
  bytes: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const buf = Buffer.from(bytes);
    const { width, height } = await sharp(buf).metadata();
    if (!width || !height) return bytes;
    const pad = Math.round(Math.max(width, height) * CUTOUT_PAD);
    const out = await sharp(buf)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' })
      .webp({ quality: 90 }) // webp = invoerformaat van rembg; geen extra lossy generatie
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return bytes; // padding niet-fataal: val terug op het origineel
  }
}

// Uniforme weergave: crop naar de kleding-bbox (alpha) en centreer op een vierkant.
const CUTOUT_SIZE = 1024;
const CUTOUT_FILL = 0.86; // kleding vult deze fractie van de vierkante tegel
const CUTOUT_ALPHA_MIN = 16;

export async function normalizeCutout(png: Uint8Array): Promise<Uint8Array> {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  // alpha-bbox zelf bepalen: sharp's kleur-trim faalt op rembg's willekeurige RGB onder alpha=0
  const { data, info } = await sharp(Buffer.from(png))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > CUTOUT_ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return png; // geen kledingpixels → ongemoeid laten

  const inner = Math.round(CUTOUT_SIZE * CUTOUT_FILL);
  const garment = await sharp(Buffer.from(png))
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false, background: transparent })
    .png()
    .toBuffer();
  const out = await sharp({
    create: { width: CUTOUT_SIZE, height: CUTOUT_SIZE, channels: 4, background: transparent }
  })
    .composite([{ input: garment, gravity: 'center' }])
    .png()
    .toBuffer();
  return new Uint8Array(out);
}

// Schrijft een cutout-PNG (transparante achtergrond) + een kleine transparante
// thumbnail-webp (voor grids/lijsten). Geeft de cutout-bestandsnaam terug.
export async function saveCutout(id: number, png: Uint8Array): Promise<string> {
  ensureDirs();
  const name = `${id}.png`;
  await writeFile(join(baseDir(), 'cutout', name), png);
  try {
    await sharp(Buffer.from(png))
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, alphaQuality: 90 })
      .toFile(join(baseDir(), 'thumb', `${id}.webp`));
  } catch {
    /* thumb is optioneel; grid valt terug op de cutout */
  }
  return name;
}

// Schrijft een outfit-thumbnail (afgevlakte PNG) en geeft de bestandsnaam terug.
export async function saveOutfitThumb(id: number, png: Uint8Array): Promise<string> {
  ensureDirs();
  const name = `${id}.png`;
  await writeFile(join(baseDir(), 'outfit', name), png);
  return name;
}

// Verwijdert een outfit-thumbnail (ontbrekend bestand negeren).
export async function deleteOutfitThumb(thumbPath: string | null): Promise<void> {
  if (!thumbPath) return;
  await unlink(join(baseDir(), 'outfit', thumbPath)).catch(() => {});
}

// Verwijdert alle varianten van een item; ontbrekende bestanden negeren.
export async function deletePhotos(names: {
  photo_orig?: string | null;
  photo_display?: string | null;
  cutout_path?: string | null;
}): Promise<void> {
  // thumb deelt de basisnaam met de cutout (<id>.png → <id>.webp)
  const thumbName = names.cutout_path ? names.cutout_path.replace(/\.png$/, '.webp') : null;
  const targets: [Variant, string | null | undefined][] = [
    ['orig', names.photo_orig],
    ['disp', names.photo_display],
    ['cutout', names.cutout_path],
    ['thumb', thumbName]
  ];
  await Promise.all(
    targets
      .filter(([, n]) => n)
      .map(([v, n]) => unlink(join(baseDir(), v, n as string)).catch(() => {}))
  );
}

function safeFilename(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..');
}

export interface PhotoFile {
  data: Uint8Array<ArrayBuffer>;
  contentType: string;
}

// Leest een fotobestand voor de serving-route. null bij ongeldige variant/naam of ontbrekend bestand.
export async function readPhoto(variant: string, filename: string): Promise<PhotoFile | null> {
  if (!VARIANTS.includes(variant as Variant) || !safeFilename(filename)) return null;
  try {
    const buf = await readFile(join(baseDir(), variant, filename));
    // kopie naar een Uint8Array<ArrayBuffer> (geldige BodyInit; Buffer.buffer is ArrayBufferLike)
    const data = Uint8Array.from(buf);
    const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
    const contentType =
      variant === 'disp' ? 'image/webp' : variant === 'cutout' ? 'image/png' : mimeForExt(ext);
    return { data, contentType };
  } catch {
    return null;
  }
}

export function photoUrl(variant: Variant, name: string | null): string | null {
  return name ? `/photos/${variant}/${name}` : null;
}

export { mimeForExt };
