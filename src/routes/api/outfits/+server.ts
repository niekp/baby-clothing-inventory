import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createOutfit,
  deleteOutfit,
  getOutfit,
  isForeignKeyError,
  listOutfits,
  listOutfitSizes,
  setOutfitPhotoOrig
} from '$lib/server/outfits';
import { enqueueOutfitCutout } from '$lib/server/db';
import { deleteOutfitPhotos, extForMime, saveOutfitOrig } from '$lib/server/photos';
import { serializeOutfit } from '$lib/server/serialize';
import { parseLayout, parseOutfitSize } from '$lib/server/outfit-validate';
import { isSize } from '$lib/config';

export const GET: RequestHandler = ({ url }) => {
  const sizes = url.searchParams.getAll('size').filter(isSize);
  const outfits = listOutfits(sizes.length ? sizes : undefined).map(serializeOutfit);
  return json({ outfits, sizes: listOutfitSizes() });
};

export const POST: RequestHandler = async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) return createPhotoOutfit(request);

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
};

// Foto-outfit: bron opslaan + isnet-cutout in de wachtrij (fire-and-forget; birefnet volgt).
async function createPhotoOutfit(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    error(400, 'Ongeldige form-data');
  }
  const nameRaw = form.get('name');
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  const size = parseOutfitSize(form.get('size'));
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) error(400, 'Foto verplicht');

  const outfit = createOutfit(name, [], size); // geen items → foto-outfit
  const ext = extForMime(photo.type, photo.name);
  try {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const origName = await saveOutfitOrig(outfit.id, buffer, ext);
    setOutfitPhotoOrig(outfit.id, origName);
    enqueueOutfitCutout(outfit.id); // leeg model = isnet (snel); birefnet volgt automatisch
  } catch (e) {
    // geen wees-rij/-bestand achterlaten
    await deleteOutfitPhotos({ photo_orig: `${outfit.id}.${ext}`, thumb_path: null });
    deleteOutfit(outfit.id);
    throw e;
  }
  // herlees ná photo_orig zetten zodat de DTO is_photo/urls kloppen
  return json(serializeOutfit(getOutfit(outfit.id)!), { status: 201 });
}
