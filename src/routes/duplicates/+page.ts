import type { PageLoad } from './$types';
import type { ItemDTO } from '$lib/server/serialize';

export interface DuplicatePairDTO {
  score: number;
  a: ItemDTO;
  b: ItemDTO;
}

export const load: PageLoad = async ({ fetch }) => {
  const [pairsRes, backfillRes] = await Promise.all([
    fetch('/api/duplicates'),
    fetch('/api/duplicates/backfill')
  ]);
  const pairs = pairsRes.ok ? ((await pairsRes.json()) as DuplicatePairDTO[]) : [];
  const missing = backfillRes.ok ? ((await backfillRes.json()) as { missing: number }).missing : 0;
  return { pairs, missing };
};
