import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createChild, listChildren } from '$lib/server/db';
import { parseChildSizes } from '$lib/server/children';

export const GET: RequestHandler = () => json(listChildren());

export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown; current_sizes?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  return json(createChild(name, parseChildSizes(body.current_sizes)), { status: 201 });
};
