// Canonieke filter-querystring. Eén bron voor list-API, kast-filters, filtersets
// en heatmap-deeplinks. Param-namen: size,type,length,season,quality,color
// (multi, komma-gescheiden), favorite (1), q (vrij zoeken), sort (size|newest).
import type { ItemFilters } from '$lib/types';

const MULTI_KEYS = ['size', 'type', 'length', 'season', 'quality', 'color'] as const;

type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(params: ParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v.join(',') : v;
}

export function parseItemFilters(params: ParamsLike): ItemFilters {
  const filters: ItemFilters = {};
  for (const key of MULTI_KEYS) {
    const raw = getParam(params, key);
    if (raw) {
      const vals = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (vals.length) filters[key] = vals;
    }
  }
  const fav = getParam(params, 'favorite');
  if (fav === '1' || fav === 'true') filters.favorite = true;
  const q = getParam(params, 'q');
  if (q) filters.search = q;
  if (getParam(params, 'sort') === 'size') filters.sort = 'size';
  return filters;
}

// Serialiseert filters terug naar een canonieke querystring (zonder leading '?').
export function buildItemQuery(filters: ItemFilters): string {
  const params = new URLSearchParams();
  for (const key of MULTI_KEYS) {
    const vals = filters[key];
    if (vals && vals.length) params.set(key, vals.join(','));
  }
  if (filters.favorite) params.set('favorite', '1');
  if (filters.search) params.set('q', filters.search);
  if (filters.sort === 'size') params.set('sort', 'size');
  return params.toString();
}
