import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ItemDTO } from '$lib/server/serialize';

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/items/${params.id}`);
  if (res.status === 404) error(404, 'Item niet gevonden');
  if (!res.ok) error(500, 'Item kon niet geladen worden');
  return { item: (await res.json()) as ItemDTO };
};
