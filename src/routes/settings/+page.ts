import type { PageLoad } from './$types';
import type { Child } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('/api/children');
  const children = res.ok ? ((await res.json()) as Child[]) : [];
  const cr = await fetch('/api/cutouts');
  const cutouts = cr.ok
    ? ((await cr.json()) as { notSharp: number; queued: number })
    : { notSharp: 0, queued: 0 };
  return { children, cutouts };
};
