import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enqueueOutfitCutout } from '$lib/server/db';
import { getOutfit } from '$lib/server/outfits';
import { serializeOutfit } from '$lib/server/serialize';

// Zet een scherpe (birefnet) cutout voor een foto-outfit in de wachtrij. Worker draint serieel.
export const POST: RequestHandler = ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) error(400, 'Ongeldig id');
  const outfit = getOutfit(id);
  if (!outfit) error(404, 'Niet gevonden');
  if (!outfit.photo_orig) error(409, 'Geen foto-outfit');

  // Loopt/staat er al een cutout-job? Dan komt de scherpe versie al aan (twee-traps) —
  // niet opnieuw enqueuen (voorkomt dat de worker-clear de nieuwe job wist).
  if (!outfit.cutout_job) enqueueOutfitCutout(id, 'birefnet-general');
  return json(serializeOutfit(getOutfit(id)!), { status: 202 });
};
