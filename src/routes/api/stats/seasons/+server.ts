import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countBySizeTypeSeason } from '$lib/server/db';

// Aggregatie maat × type × seizoen voor de seizoen-matrix.
export const GET: RequestHandler = () => json(countBySizeTypeSeason());
