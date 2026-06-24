import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createItem, deleteItem, queryItems, updateItem } from '$lib/server/db';
import { deletePhotos, extForMime, savePhoto } from '$lib/server/photos';
import { serializeItem } from '$lib/server/serialize';
import { parseItemFilters } from '$lib/filters';
import { isSeason, SIZES } from '$lib/config';
import type { ItemInput } from '$lib/types';

const SIZE_SET = new Set(SIZES.map(String));

function str(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

export const GET: RequestHandler = ({ url }) => {
  const items = queryItems(parseItemFilters(url.searchParams));
  return json(items.map(serializeItem));
};

export const POST: RequestHandler = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    error(400, 'Ongeldige form-data');
  }

  const size = str(form, 'size');
  if (!size || !SIZE_SET.has(size)) error(400, 'Ongeldige of ontbrekende maat');

  // seizoenen: meerdere form-velden 'season' (alleen geldige waarden)
  const seasons = form
    .getAll('season')
    .filter((v): v is string => typeof v === 'string' && isSeason(v));

  const input: ItemInput = {
    size,
    type: str(form, 'type') ?? null,
    length: str(form, 'length') ?? null,
    seasons,
    quality: str(form, 'quality') ?? null,
    color: str(form, 'color') ?? null,
    note: str(form, 'note') ?? null,
    favorite: str(form, 'favorite') === '1' ? 1 : 0,
    ai_status: 'none'
  };

  // Eerst de rij (id nodig om de foto te benoemen).
  let item = createItem(input);

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = extForMime(photo.type, photo.name);
    try {
      const saved = await savePhoto(item.id, buffer, ext);
      // display ok → klaar voor AI; display gefaald → bruikbaar zonder AI.
      item =
        updateItem(item.id, {
          photo_orig: saved.origName,
          photo_display: saved.dispName,
          ai_status: saved.dispName ? 'processing' : 'none'
        }) ?? item;
    } catch (e) {
      // geen wees-bestanden/-rij achterlaten bij een schrijf-/db-fout
      await deletePhotos({ photo_orig: `${item.id}.${ext}`, photo_display: `${item.id}.webp` });
      deleteItem(item.id);
      throw e;
    }
  }

  return json(serializeItem(item), { status: 201 });
};
