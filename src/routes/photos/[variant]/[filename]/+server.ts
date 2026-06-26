import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readPhoto } from '$lib/server/photos';

export const GET: RequestHandler = async ({ params }) => {
  const file = await readPhoto(params.variant, params.filename);
  if (!file) error(404, 'Niet gevonden');
  return new Response(file.data, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
};
