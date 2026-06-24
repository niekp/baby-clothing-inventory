import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Variant = 'orig' | 'disp' | 'cutout' | 'outfit';
const VARIANTS: Variant[] = ['orig', 'disp', 'cutout', 'outfit'];

const DISPLAY_MAX = 1024;
const DISPLAY_QUALITY = 80;

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

// Schrijft een cutout-PNG (transparante achtergrond) en geeft de bestandsnaam terug.
export async function saveCutout(id: number, png: Uint8Array): Promise<string> {
  ensureDirs();
  const name = `${id}.png`;
  await writeFile(join(baseDir(), 'cutout', name), png);
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
  const targets: [Variant, string | null | undefined][] = [
    ['orig', names.photo_orig],
    ['disp', names.photo_display],
    ['cutout', names.cutout_path]
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
