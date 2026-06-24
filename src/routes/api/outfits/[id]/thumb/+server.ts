import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOutfit, setOutfitThumb } from '$lib/server/outfits';
import { photoUrl, saveOutfitThumb } from '$lib/server/photos';

// Slaat de afgevlakte galerij-thumbnail (PNG-blob van de client) op.
export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  if (!getOutfit(id)) error(404, 'Niet gevonden');

  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength === 0) error(400, 'Lege thumbnail');
  const name = await saveOutfitThumb(id, buf);
  setOutfitThumb(id, name);
  return json({ thumb_url: photoUrl('outfit', name) });
};
