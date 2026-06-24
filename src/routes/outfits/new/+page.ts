import type { PageLoad } from './$types';
import type { ItemDTO } from '$lib/server/serialize';

// Alle items voor de picker (cutouts waar beschikbaar).
export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/items');
  const items = res.ok ? ((await res.json()) as ItemDTO[]) : [];
  return { items };
};
