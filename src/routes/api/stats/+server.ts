import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countBySizeType } from '$lib/server/db';

// Aggregatie maat × type voor de heatmap.
export const GET: RequestHandler = () => json(countBySizeType());
