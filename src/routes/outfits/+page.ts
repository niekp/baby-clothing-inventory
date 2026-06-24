import type { PageLoad } from './$types';
import type { OutfitDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/outfits');
  const outfits = res.ok ? ((await res.json()) as OutfitDTO[]) : [];
  return { outfits };
};
