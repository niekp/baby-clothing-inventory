import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enqueueCutout, getItem, updateItem } from '$lib/server/db';
import { deletePhotos, extForMime, savePhoto } from '$lib/server/photos';
import { serializeItem } from '$lib/server/serialize';

// Vervangt de foto van een bestaand item (labels blijven). Slaat orig+display op,
// vernieuwt de cutout met isnet. Geen re-tag.
export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  const before = getItem(id);
  if (!before) error(404, 'Niet gevonden');

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    error(400, 'Ongeldige form-data');
  }
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) error(400, 'Geen foto');

  const buffer = Buffer.from(await photo.arrayBuffer());
  const ext = extForMime(photo.type, photo.name);
  const saved = await savePhoto(id, buffer, ext);
  updateItem(id, { photo_orig: saved.origName, photo_display: saved.dispName });
  // oude orig met andere extensie zou anders als wees achterblijven (display/cutout overschrijven zelf)
  if (before.photo_orig && before.photo_orig !== saved.origName) {
    await deletePhotos({ photo_orig: before.photo_orig });
  }

  // cutout verversen via de wachtrij (isnet; worker pakt 't op)
  if (saved.dispName) enqueueCutout(id);
  return json(serializeItem(getItem(id)!), { status: 202 });
};
