import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOutfit, isForeignKeyError, listOutfits } from '$lib/server/outfits';
import { serializeOutfit } from '$lib/server/serialize';
import { parseLayout } from '$lib/server/outfit-validate';

export const GET: RequestHandler = () => json(listOutfits().map(serializeOutfit));

export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  const items = parseLayout(body.items ?? []);
  try {
    return json(serializeOutfit(createOutfit(name, items)), { status: 201 });
  } catch (e) {
    if (isForeignKeyError(e)) error(400, 'Layout verwijst naar een niet-bestaand item');
    throw e;
  }
};
