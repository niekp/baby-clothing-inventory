import type { PageLoad } from './$types';
import { parseItemFilters } from '$lib/filters';
import type { ItemDTO } from '$lib/server/serialize';
import type { Child, Filterset } from '$lib/types';

export const load: PageLoad = async ({ fetch, url }) => {
  const qs = url.searchParams.toString();
  const [itemsRes, inboxRes, fsRes, childRes] = await Promise.all([
    fetch(`/api/items?${qs}`),
    fetch('/api/items/inbox'),
    fetch('/api/filtersets'),
    fetch('/api/children')
  ]);
  // bij een API-fout: lege/veilige fallback i.p.v. een crashende load
  const items = itemsRes.ok ? ((await itemsRes.json()) as ItemDTO[]) : [];
  const inbox = inboxRes.ok ? ((await inboxRes.json()) as ItemDTO[]) : [];
  const filtersets = fsRes.ok ? ((await fsRes.json()) as Filterset[]) : [];
  const children = childRes.ok ? ((await childRes.json()) as Child[]) : [];
  // status-telling voor de live verwerkingsindicator bovenaan de Kast
  const aiCounts = {
    processing: inbox.filter((i) => i.ai_status === 'processing' || i.ai_status === 'working').length,
    suggested: inbox.filter((i) => i.ai_status === 'suggested').length,
    failed: inbox.filter((i) => i.ai_status === 'failed').length
  };
  return {
    items,
    inboxCount: inbox.length,
    aiCounts,
    filtersets,
    children,
    filters: parseItemFilters(url.searchParams)
  };
};
