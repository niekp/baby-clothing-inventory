import type { PageLoad } from './$types';
import type { Child } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/children');
  const children = res.ok ? ((await res.json()) as Child[]) : [];
  return { children };
};
