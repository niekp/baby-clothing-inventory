import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reprocessCutouts } from '$lib/server/worker';

// Eenmalig: her-normaliseer bestaande cutouts (uniform vierkant) + herbereken
// embedding/kleur-histogram. Idempotent.
export const POST: RequestHandler = async () => json(await reprocessCutouts());
