import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  deleteOutfit,
  getOutfit,
  getOutfitWithItems,
  isForeignKeyError,
  updateOutfit
} from '$lib/server/outfits';
import { serializeItem, serializeOutfit } from '$lib/server/serialize';
import { deleteOutfitPhotos, deleteOutfitThumb } from '$lib/server/photos';
import { parseLayout, parseOutfitSize } from '$lib/server/outfit-validate';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  return id;
}

export const GET: RequestHandler = ({ params }) => {
  const data = getOutfitWithItems(parseId(params.id));
  if (!data) error(404, 'Niet gevonden');
  return json({
    ...serializeOutfit(data.outfit),
    items: data.items.map((oi) => ({
      id: oi.id,
      item_id: oi.item_id,
      x: oi.x,
      y: oi.y,
      scale: oi.scale,
      rotation: oi.rotation,
      z_index: oi.z_index,
      item: serializeItem(oi.item)
    }))
  });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
  let body: { name?: unknown; items?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const patch: { name?: string; items?: ReturnType<typeof parseLayout>; size?: string | null } = {};
  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (!n) error(400, 'Naam mag niet leeg zijn');
    patch.name = n;
  }
  if ('size' in body) patch.size = parseOutfitSize(body.size);
  if ('items' in body) {
    // hybride-guard: een foto-outfit mag geen sleep-layout krijgen
    if (getOutfit(id)?.photo_orig) error(400, 'Foto-outfit heeft geen layout-items');
    patch.items = parseLayout(body.items);
  }

  try {
    const updated = updateOutfit(id, patch);
    if (!updated) error(404, 'Niet gevonden');
    return json(serializeOutfit(updated));
  } catch (e) {
    if (isForeignKeyError(e)) error(400, 'Layout verwijst naar een niet-bestaand item');
    throw e;
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseId(params.id);
  const outfit = getOutfit(id);
  if (!outfit) error(404, 'Niet gevonden');
  // foto-outfit: bron + cutout-PNG + webp opruimen; item-outfit: alleen de thumb
  if (outfit.photo_orig) {
    await deleteOutfitPhotos(id, { photo_orig: outfit.photo_orig });
  } else {
    await deleteOutfitThumb(id);
  }
  deleteOutfit(id);
  return new Response(null, { status: 204 });
};
