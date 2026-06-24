import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteItem, getItem, updateItem } from '$lib/server/db';
import { deletePhotos } from '$lib/server/photos';
import { serializeItem } from '$lib/server/serialize';
import { AI_STATUSES, isLength, isQuality, isSeason, isType, SIZES } from '$lib/config';
import type { Item } from '$lib/types';

const SIZE_SET = new Set(SIZES.map(String));
const AI_SET = new Set<string>(AI_STATUSES);

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  return id;
}

export const GET: RequestHandler = ({ params }) => {
  const item = getItem(parseId(params.id));
  if (!item) error(404, 'Niet gevonden');
  return json(serializeItem(item));
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const id = parseId(params.id);
  if (!getItem(id)) error(404, 'Niet gevonden');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    error(400, 'Ongeldige JSON');
  }
  const patch: Partial<Item> = {};

  // vrije-tekstvelden
  for (const k of ['color', 'note'] as const) {
    if (k in body) patch[k] = body[k] == null ? null : String(body[k]);
  }
  // enum-velden: alleen geldige opties (of null om te wissen)
  const ENUM_CHECK = { type: isType, length: isLength, quality: isQuality } as const;
  for (const k of ['type', 'length', 'quality'] as const) {
    if (!(k in body)) continue;
    if (body[k] == null) {
      patch[k] = null;
      continue;
    }
    const v = String(body[k]);
    if (!ENUM_CHECK[k](v)) error(400, `Ongeldige ${k}`);
    patch[k] = v;
  }
  // seizoenen: array van geldige waarden → JSON in de season-kolom (of null)
  if ('seasons' in body) {
    const raw = Array.isArray(body.seasons) ? body.seasons : [];
    const valid = raw.filter((s): s is string => typeof s === 'string' && isSeason(s));
    patch.season = valid.length ? JSON.stringify(valid) : null;
  }
  if ('size' in body) {
    const s = String(body.size);
    if (!SIZE_SET.has(s)) error(400, 'Ongeldige maat');
    patch.size = s;
  }
  if ('favorite' in body) patch.favorite = body.favorite ? 1 : 0;
  if ('ai_status' in body) {
    const s = String(body.ai_status);
    if (!AI_SET.has(s)) error(400, 'Ongeldige ai_status');
    patch.ai_status = s as Item['ai_status'];
  }

  const updated = updateItem(id, patch);
  return json(serializeItem(updated!));
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = parseId(params.id);
  const item = getItem(id);
  if (!item) error(404, 'Niet gevonden');
  await deletePhotos(item);
  deleteItem(id);
  return new Response(null, { status: 204 });
};
