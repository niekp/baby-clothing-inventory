import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem } from '$lib/server/db';
import { readPhoto } from '$lib/server/photos';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  const item = getItem(id);
  if (!item?.photo_orig) error(404, 'Geen origineel');

  const file = await readPhoto('orig', item.photo_orig);
  if (!file) error(404, 'Bestand ontbreekt');

  return new Response(file.data, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${item.photo_orig}"`,
      'Cache-Control': 'private, max-age=0'
    }
  });
};
