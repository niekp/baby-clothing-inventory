import type { LayoutServerLoad } from './$types';
import { findDuplicatePairs } from '$lib/server/duplicates';

// Aantal openstaande dubbel-kandidaten voor de badge in de nav. Goedkoop (O(n²)
// over een kleine kast); ververst via invalidateAll na bevestigen/negeren.
export const load: LayoutServerLoad = () => {
  return { duplicateCount: findDuplicatePairs().length };
};
