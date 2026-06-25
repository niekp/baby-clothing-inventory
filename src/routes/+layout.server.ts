import type { LayoutServerLoad } from './$types';
import { duplicateCount } from '$lib/server/duplicates';

// Dubbel-kandidaten voor de nav-badge; gecachet op staat-vingerafdruk (geen O(n²) per navigatie).
export const load: LayoutServerLoad = () => {
  return { duplicateCount: duplicateCount() };
};
