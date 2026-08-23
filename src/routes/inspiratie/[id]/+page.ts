import { error, redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { OutfitWithItemsDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/outfits/${params.id}`);
  if (res.status === 404) error(404, 'Inspiratie niet gevonden');
  if (!res.ok) error(500, 'Inspiratie kon niet geladen worden');
  const inspiration = (await res.json()) as OutfitWithItemsDTO;
  if (inspiration.kind === 'own') redirect(307, `/outfits/${inspiration.id}`);
  return { inspiration };
};
