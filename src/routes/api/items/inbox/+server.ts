import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { queryItems } from '$lib/server/db';
import { serializeItem } from '$lib/server/serialize';

// Inbox = gescande items die nog niet afgehandeld zijn (los van de AI).
// Niet alleen 'suggested': ook 'processing'/'working'/'failed' zodat je zonder
// (of vóór) AI je scans kunt nalopen. Nieuwste eerst (queryItems-default) zodat
// jij vanaf de nieuwste werkt terwijl de worker vanaf de oudste claimt → minder botsing.
export const GET: RequestHandler = () => {
  const items = queryItems({ ai_status: ['processing', 'working', 'suggested', 'failed'] });
  return json(items.map(serializeItem));
};
