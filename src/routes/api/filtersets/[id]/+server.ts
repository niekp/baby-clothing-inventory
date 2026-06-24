import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteFilterset, updateFilterset } from '$lib/server/db';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  return id;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
  let body: { name?: unknown; filter?: unknown; pinned?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const patch: { name?: string; filter_json?: string; pinned?: number } = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('filter' in body) {
    if (typeof body.filter !== 'string') error(400, 'filter moet een querystring zijn');
    patch.filter_json = body.filter;
  }
  if ('pinned' in body) patch.pinned = body.pinned ? 1 : 0;

  const updated = updateFilterset(id, patch);
  if (!updated) error(404, 'Niet gevonden');
  return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
  const id = parseId(params.id);
  if (!deleteFilterset(id)) error(404, 'Niet gevonden');
  return new Response(null, { status: 204 });
};
