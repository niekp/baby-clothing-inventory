import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dismissDuplicate } from '$lib/server/db';

// Markeert een paar als 'niet hetzelfde' zodat het niet meer wordt voorgesteld.
export const POST: RequestHandler = async ({ request }) => {
  let body: { a?: unknown; b?: unknown };
  try {
    body = await request.json();
  } catch {
    error(400, 'Ongeldige JSON');
  }
  const a = Number(body?.a);
  const b = Number(body?.b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) {
    error(400, 'Ongeldig paar');
  }
  dismissDuplicate(a, b);
  return new Response(null, { status: 204 });
};
