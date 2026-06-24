import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { countMissingEmbedding } from '$lib/server/db';
import { backfillEmbeddings } from '$lib/server/worker';

// Hoeveel items nog een embedding missen (met cutout).
export const GET: RequestHandler = () => json({ missing: countMissingEmbedding() });

// Bereken ontbrekende embeddings (serieel; kleine kast).
export const POST: RequestHandler = async () => json(await backfillEmbeddings());
