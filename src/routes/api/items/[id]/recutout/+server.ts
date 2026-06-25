import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem } from '$lib/server/db';
import { readPhoto } from '$lib/server/photos';
import { generateCutout } from '$lib/server/worker';
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

  const norm = await generateCutout(id, file.data, model);
  if (!norm) error(502, 'Cutout mislukt');
  return json(serializeItem(getItem(id)!));
};
