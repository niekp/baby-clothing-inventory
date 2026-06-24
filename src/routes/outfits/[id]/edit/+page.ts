import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ItemDTO, OutfitWithItemsDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch, params }) => {
  const [outfitRes, itemsRes] = await Promise.all([
    fetch(`/api/outfits/${params.id}`),
    fetch('/api/items')
  ]);
  if (outfitRes.status === 404) error(404, 'Outfit niet gevonden');
  if (!outfitRes.ok) error(500, 'Outfit kon niet geladen worden');
  const outfit = (await outfitRes.json()) as OutfitWithItemsDTO;
  const items = itemsRes.ok ? ((await itemsRes.json()) as ItemDTO[]) : [];
  return { outfit, items };
};
