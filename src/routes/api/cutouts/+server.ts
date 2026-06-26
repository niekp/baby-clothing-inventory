import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countNotSharp, countQueuedCutouts, enqueueSharpenAll } from '$lib/server/db';

// Status van de cutout-kwaliteit: hoeveel items nog niet scherp (birefnet) zijn
// en hoeveel er in de wachtrij staan.
export const GET: RequestHandler = () =>
  json({ notSharp: countNotSharp(), queued: countQueuedCutouts() });

// "Verbeter alles": alle nog-niet-scherpe items in de birefnet-queue. Worker draint serieel.
export const POST: RequestHandler = () => {
  const queued = enqueueSharpenAll();
  return json({ queued, total: countQueuedCutouts() }, { status: 202 });
};
