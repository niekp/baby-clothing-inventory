import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enqueueCutout, getItem } from '$lib/server/db';
import { serializeItem } from '$lib/server/serialize';

// Zet een (re)cutout in de wachtrij. isnet (snel) of birefnet-general (scherper, ~2-3 min).
// De worker draint serieel; antwoordt direct (geen lang inline-request).
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

  enqueueCutout(id, model);
  return json(serializeItem(getItem(id)!), { status: 202 });
};
