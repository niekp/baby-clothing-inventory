import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFilterset, listFiltersets } from '$lib/server/db';

export const GET: RequestHandler = () => json(listFiltersets());

export const POST: RequestHandler = async ({ request }) => {
  let body: { name?: unknown; filter?: unknown; pinned?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) error(400, 'Naam verplicht');
  // filter MOET de canonieke querystring zijn (string) — geen JSON-object, anders
  // breekt navigatie (goto(`/?${filter}`)) stilletjes.
  if (body.filter != null && typeof body.filter !== 'string') error(400, 'filter moet een querystring zijn');
  const filterJson = typeof body.filter === 'string' ? body.filter : '';
  const pinned = body.pinned ? 1 : 0;
  return json(createFilterset(name, filterJson, pinned), { status: 201 });
};
