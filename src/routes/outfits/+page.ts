import type { PageLoad } from './$types';
import type { OutfitDTO } from '$lib/server/serialize';
import { isSize } from '$lib/config';

export const load: PageLoad = async ({ fetch, url }) => {
  const sizes = url.searchParams.getAll('size').filter(isSize);
  const qs = sizes.map((s) => `size=${encodeURIComponent(s)}`).join('&');
  const res = await fetch(`/api/outfits${qs ? `?${qs}` : ''}`);
  const data = res.ok
    ? ((await res.json()) as { outfits: OutfitDTO[]; sizes: string[] })
    : { outfits: [], sizes: [] };
  return { outfits: data.outfits, availableSizes: data.sizes, sizeFilter: sizes };
};
