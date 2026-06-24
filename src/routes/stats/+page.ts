import type { PageLoad } from './$types';
import type { Child } from '$lib/types';

type Count = { size: string; type: string | null; n: number };

export const load: PageLoad = async ({ fetch }) => {
  const [statsRes, childRes] = await Promise.all([fetch('/api/stats'), fetch('/api/children')]);
  const counts = statsRes.ok ? ((await statsRes.json()) as Count[]) : [];
  const children = childRes.ok ? ((await childRes.json()) as Child[]) : [];
  const total = counts.reduce((s, c) => s + c.n, 0);
  return { counts, children, total };
};
