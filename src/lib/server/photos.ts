import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Variant = 'orig' | 'disp' | 'cutout' | 'thumb' | 'outfit' | 'outfit_orig';
const VARIANTS: Variant[] = ['orig', 'disp', 'cutout', 'thumb', 'outfit', 'outfit_orig'];

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

// Uniforme weergave: crop naar de kleding-bbox (alpha) en centreer op een vierkant.
const CUTOUT_SIZE = 1024;
const CUTOUT_FILL = 0.86; // kleding vult deze fractie van de vierkante tegel
const CUTOUT_ALPHA_MIN = 16;

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Alpha-bbox zelf bepalen: sharp's kleur-trim faalt op rembg's willekeurige RGB onder alpha=0.
// null als er geen kledingpixels boven de alpha-drempel zijn.
async function alphaBBox(png: Uint8Array): Promise<BBox | null> {
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
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

export async function normalizeCutout(png: Uint8Array): Promise<Uint8Array> {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const bbox = await alphaBBox(png);
  if (!bbox) return png; // geen kledingpixels → ongemoeid laten
  const { minX, minY, maxX, maxY } = bbox;

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

// Foto-outfit-normalisatie: crop naar de kleding-bbox, aspect behouden, met wat
// transparante marge — géén geforceerd vierkant (een outfit-flat-lay is vaak staand).
const OUTFIT_MARGIN = 0.04; // marge als fractie van de langste bbox-zijde
const OUTFIT_CUTOUT_MAX = 1024; // langste zijde begrensen (voorkomt full-res PNG's)

export async function normalizeOutfitCutout(png: Uint8Array): Promise<Uint8Array> {
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const bbox = await alphaBBox(png);
  if (!bbox) return png; // geen kledingpixels → ongemoeid laten
  const { minX, minY, maxX, maxY } = bbox;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const margin = Math.round(Math.max(w, h) * OUTFIT_MARGIN);
  const out = await sharp(Buffer.from(png))
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: w, height: h })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: transparent })
    .resize(OUTFIT_CUTOUT_MAX, OUTFIT_CUTOUT_MAX, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return new Uint8Array(out);
}

// Schrijft een outfit-thumbnail/cutout (PNG) en geeft de bestandsnaam terug.
export async function saveOutfitThumb(id: number, png: Uint8Array): Promise<string> {
  ensureDirs();
  const name = `${id}.png`;
  await writeFile(join(baseDir(), 'outfit', name), png);
  return name;
}

// Kleine transparante webp-thumb van een foto-outfit-cutout (voor de lijst).
export async function saveOutfitCutoutThumb(id: number, png: Uint8Array): Promise<void> {
  ensureDirs();
  try {
    await sharp(Buffer.from(png))
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY, alphaQuality: 90 })
      .toFile(join(baseDir(), 'outfit', `${id}.webp`));
  } catch {
    /* thumb is optioneel; lijst valt terug op de PNG */
  }
}

// Schrijft de bronfoto van een foto-outfit en geeft de bestandsnaam terug.
export async function saveOutfitOrig(id: number, buffer: Buffer, ext: string): Promise<string> {
  ensureDirs();
  const name = `${id}.${ext}`;
  await writeFile(join(baseDir(), 'outfit_orig', name), buffer);
  return name;
}

// Verwijdert een outfit-thumbnail (ontbrekend bestand negeren).
export async function deleteOutfitThumb(thumbPath: string | null): Promise<void> {
  if (!thumbPath) return;
  await unlink(join(baseDir(), 'outfit', thumbPath)).catch(() => {});
}

// Verwijdert alle bestanden van een foto-outfit (bron + cutout-PNG + webp-thumb).
export async function deleteOutfitPhotos(names: {
  photo_orig?: string | null;
  thumb_path?: string | null;
}): Promise<void> {
  const targets: [Variant, string | null | undefined][] = [
    ['outfit_orig', names.photo_orig],
    ['outfit', names.thumb_path],
    ['outfit', names.thumb_path ? names.thumb_path.replace(/\.png$/, '.webp') : null]
  ];
  await Promise.all(
    targets
      .filter(([, n]) => n)
      .map(([v, n]) => unlink(join(baseDir(), v, n as string)).catch(() => {}))
  );
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

// Versioneert op mtime: bestandsnamen zijn stabiel (<id>.webp/.png), dus zonder
// ?v overschrijft een nieuwe foto de cache niet. Stat faalt → kale URL.
export function photoUrl(variant: Variant, name: string | null): string | null {
  if (!name) return null;
  const url = `/photos/${variant}/${name}`;
  try {
    return `${url}?v=${Math.floor(statSync(join(baseDir(), variant, name)).mtimeMs)}`;
  } catch {
    return url;
  }
}

export { mimeForExt };
