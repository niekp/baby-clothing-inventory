import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createInspiration,
  createOutfit,
  deleteOutfit,
  getOutfit,
  isForeignKeyError,
  listInspiration,
  listOutfits,
  listOutfitSizes,
  setOutfitPhotoOrig
} from '$lib/server/outfits';
import { enqueueOutfitCutout } from '$lib/server/db';
import {
  deleteOutfitPhotos,
  extForMime,
  isSupportedImageMime,
  saveOutfitOrig
} from '$lib/server/photos';
import { serializeOutfit } from '$lib/server/serialize';
import { parseLayout, parseOutfitSize } from '$lib/server/outfit-validate';
import { isSize } from '$lib/config';
import type { Outfit, OutfitKind } from '$lib/types';

// kind=inspiration geeft de inspiratie-lijst (maat-filter geldt daar niet); default is 'own'.
export const GET: RequestHandler = ({ url }) => {
  const kind = parseKind(url.searchParams.get('kind'));
  if (kind === 'inspiration') {
    return json({ outfits: listInspiration().map(serializeOutfit), sizes: [] });
  }
  const sizes = url.searchParams.getAll('size').filter(isSize);
  const outfits = listOutfits(sizes.length ? sizes : undefined).map(serializeOutfit);
  return json({ outfits, sizes: listOutfitSizes() });
};

export const POST: RequestHandler = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) return createItemOutfit(request);

  const form = await readForm(request);
  return parseKind(form.get('kind')) === 'inspiration'
    ? createInspirationPhoto(form)
    : createPhotoOutfit(form);
};

// Ontbrekend = 'own'; een onbekende waarde is een fout in de caller, geen stille terugval.
function parseKind(raw: FormDataEntryValue | string | null): OutfitKind {
  if (raw === null || raw === '') return 'own';
  if (raw !== 'own' && raw !== 'inspiration') error(400, 'Onbekende soort');
  return raw;
}

async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    error(400, 'Ongeldige form-data');
  }
}

function trimmed(raw: FormDataEntryValue | null): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function photoFromForm(form: FormData): File {
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) error(400, 'Foto verplicht');
  return photo;
}

// Item-outfit uit een JSON-body: een layout van items op het canvas.
async function createItemOutfit(request: Request): Promise<Response> {
  let body: { name?: unknown; items?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  const items = parseLayout(body.items ?? []);
  const size = parseOutfitSize(body.size);
  try {
    return json(serializeOutfit(createOutfit(name, items, size)), { status: 201 });
  } catch (e) {
    if (isForeignKeyError(e)) error(400, 'Layout verwijst naar een niet-bestaand item');
    throw e;
  }
}

// Eigen foto-outfit. Geen mime-whitelist: de client-normalisatie valt bij onleesbaar HEIC
// terug op het ruwe bestand.
async function createPhotoOutfit(form: FormData): Promise<Response> {
  const name = trimmed(form.get('name'));
  if (!name) error(400, 'Naam verplicht');
  const size = parseOutfitSize(form.get('size'));
  const photo = photoFromForm(form);
  return saveSourceAndQueue(createOutfit(name, [], size), photo);
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // onder BODY_SIZE_LIMIT (25M), incl. multipart-overhead

// Inspiratie-printscreen: rechtstreeks uit de galerij, dus mét mime- en groottegrens.
async function createInspirationPhoto(form: FormData): Promise<Response> {
  const photo = photoFromForm(form);
  if (!isSupportedImageMime(photo.type)) error(400, 'Alleen JPEG, PNG of WebP');
  if (photo.size > MAX_UPLOAD_BYTES) error(400, 'Afbeelding groter dan 20 MB');
  const note = trimmed(form.get('note'));
  return saveSourceAndQueue(createInspiration(note || null), photo);
}

// Bron opslaan + isnet-cutout in de wachtrij (fire-and-forget). Bij een fout: geen
// wees-rij en geen wees-bestand.
async function saveSourceAndQueue(outfit: Outfit, photo: File): Promise<Response> {
  const ext = extForMime(photo.type, photo.name);
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    setOutfitPhotoOrig(outfit.id, await saveOutfitOrig(outfit.id, buffer, ext));
    enqueueOutfitCutout(outfit.id); // leeg model = isnet (snel)
  } catch (e) {
    await deleteOutfitPhotos(outfit.id, { photo_orig: `${outfit.id}.${ext}` });
    deleteOutfit(outfit.id);
    throw e;
  }
  // herlees ná photo_orig zetten zodat de DTO is_photo/urls kloppen
  return json(serializeOutfit(getOutfit(outfit.id)!), { status: 201 });
}
