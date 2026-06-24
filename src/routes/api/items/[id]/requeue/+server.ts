import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem, updateItem } from '$lib/server/db';
import { serializeItem } from '$lib/server/serialize';

// Zet een 'failed'-item terug op 'processing' zodat de worker 't opnieuw oppakt.
export const POST: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  const item = getItem(id);
  if (!item) error(404, 'Niet gevonden');
  if (item.ai_status !== 'failed') error(409, 'Alleen mislukte items kunnen opnieuw');
  if (!item.photo_display) error(409, 'Geen display-foto om te verwerken');

  const updated = updateItem(id, { ai_status: 'processing' });
  return json(serializeItem(updated!));
};
