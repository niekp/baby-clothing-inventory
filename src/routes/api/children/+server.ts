import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createChild, listChildren } from '$lib/server/db';
import { isSize } from '$lib/config';

export const GET: RequestHandler = () => json(listChildren());

export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown; current_size?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  const size = body.current_size == null ? null : String(body.current_size);
  if (size !== null && !isSize(size)) error(400, 'Ongeldige maat');
  return json(createChild(name, size), { status: 201 });
};
