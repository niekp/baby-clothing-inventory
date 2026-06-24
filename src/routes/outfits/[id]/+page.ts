import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { OutfitWithItemsDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/outfits/${params.id}`);
  if (res.status === 404) error(404, 'Outfit niet gevonden');
  if (!res.ok) error(500, 'Outfit kon niet geladen worden');
  return { outfit: (await res.json()) as OutfitWithItemsDTO };
};
