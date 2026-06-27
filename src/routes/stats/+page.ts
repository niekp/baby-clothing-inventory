import type { PageLoad } from './$types';
import type { Child } from '$lib/types';

type Count = { size: string; type: string | null; n: number };
type SeasonRow = { size: string; type: string | null; season: string | null; n: number };

export const load: PageLoad = async ({ fetch }) => {
  const [statsRes, seasonRes, childRes] = await Promise.all([
    fetch('/api/stats'),
    fetch('/api/stats/seasons'),
    fetch('/api/children')
  ]);
  const counts = statsRes.ok ? ((await statsRes.json()) as Count[]) : [];
  const seasonRows = seasonRes.ok ? ((await seasonRes.json()) as SeasonRow[]) : [];
  const children = childRes.ok ? ((await childRes.json()) as Child[]) : [];
  const total = counts.reduce((s, c) => s + c.n, 0);
  return { counts, seasonRows, children, total };
};
