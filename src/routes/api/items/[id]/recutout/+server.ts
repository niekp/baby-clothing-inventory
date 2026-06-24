import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem, updateItem } from '$lib/server/db';
import { readPhoto, saveCutout } from '$lib/server/photos';
import { cutout } from '$lib/server/rembg';
import { serializeItem } from '$lib/server/serialize';

// Genereert de cutout opnieuw, optioneel met een ander model (bv. birefnet-general
// voor een perfecte ~47s-cutout). Inline; de 60s client-timeout dekt birefnet.
export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  const item = getItem(id);
  if (!item) error(404, 'Niet gevonden');
  if (!item.photo_display) error(409, 'Geen display-foto om te verwerken');

  const ALLOWED = new Set(['isnet-general-use', 'birefnet-general']);
  let body: { model?: unknown } = {};
  try {
    body = (await request.json()) as { model?: unknown };
  } catch {
    // lege body is prima → default model
  }
  let model: string | undefined;
  if (body && typeof body.model === 'string') {
    if (!ALLOWED.has(body.model)) error(400, 'Onbekend model');
    model = body.model;
  }

  const file = await readPhoto('disp', item.photo_display);
  if (!file) error(409, 'Display-bestand ontbreekt');

  try {
    const png = await cutout(file.data, model);
    const name = await saveCutout(id, png);
    return json(serializeItem(updateItem(id, { cutout_path: name, cutout_status: 'done' })!));
  } catch {
    try {
      updateItem(id, { cutout_status: 'failed' });
    } catch {
      /* db onbereikbaar */
    }
    error(502, 'Cutout mislukt');
  }
};
