import type { PageLoad } from './$types';
import type { ItemDTO } from '$lib/server/serialize';

// Snapshot van te-reviewen items; het deck staat vast tijdens de sessie.
export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/items/inbox');
  const items = res.ok ? ((await res.json()) as ItemDTO[]) : [];
  return { items };
};
