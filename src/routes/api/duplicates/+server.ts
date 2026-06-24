import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getItem } from '$lib/server/db';
import { findDuplicatePairs } from '$lib/server/duplicates';
import { serializeItem } from '$lib/server/serialize';

// Kandidaat-dubbelparen met geserialiseerde items (a/b) + score.
export const GET: RequestHandler = () => {
  const pairs = findDuplicatePairs()
    .map(({ a, b, score }) => {
      const ia = getItem(a);
      const ib = getItem(b);
      if (!ia || !ib) return null; // race: item ondertussen verwijderd
      return { score, a: serializeItem(ia), b: serializeItem(ib) };
    })
    .filter((p) => p !== null);
  return json(pairs);
};
