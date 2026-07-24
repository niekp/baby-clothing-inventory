import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { currentRevision } from '$lib/server/events';

// Fallback voor de SSE-stream: huidige revisie voor polling.
export const GET: RequestHandler = () => json({ revision: currentRevision() });
