import type { PageLoad } from './$types';
import type { OutfitDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/outfits?kind=inspiration');
  const data = res.ok ? ((await res.json()) as { outfits: OutfitDTO[] }) : { outfits: [] };
  return { inspiration: data.outfits };
};
