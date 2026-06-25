import type { LayoutServerLoad } from './$types';
import { duplicateCount } from '$lib/server/duplicates';

// Dubbel-kandidaten voor de nav-badge; simpele COUNT op de incrementeel onderhouden paren-tabel.
export const load: LayoutServerLoad = () => {
  return { duplicateCount: duplicateCount() };
};
