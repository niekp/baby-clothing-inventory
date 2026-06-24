import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteChild, updateChild } from '$lib/server/db';
import { parseChildSizes } from '$lib/server/children';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  return id;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
  let body: { name?: unknown; current_sizes?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const patch: { name?: string; current_sizes?: string[] } = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('current_sizes' in body) patch.current_sizes = parseChildSizes(body.current_sizes);
  const updated = updateChild(id, patch);
  if (!updated) error(404, 'Niet gevonden');
  return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
  const id = parseId(params.id);
  if (!deleteChild(id)) error(404, 'Niet gevonden');
  return new Response(null, { status: 204 });
};
