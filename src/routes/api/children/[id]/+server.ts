import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteChild, updateChild } from '$lib/server/db';
import { isSingleSize } from '$lib/config';

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  return id;
}

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
  let body: { name?: unknown; current_size?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  if (!body || typeof body !== 'object') error(400, 'Ongeldige body');
  const patch: { name?: string; current_size?: string | null } = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if ('current_size' in body) {
    const size = body.current_size == null ? null : String(body.current_size);
    if (size !== null && !isSingleSize(size)) error(400, 'Ongeldige maat');
    patch.current_size = size;
  }
  const updated = updateChild(id, patch);
  if (!updated) error(404, 'Niet gevonden');
  return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
  const id = parseId(params.id);
  if (!deleteChild(id)) error(404, 'Niet gevonden');
  return new Response(null, { status: 204 });
};
