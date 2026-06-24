import { error } from '@sveltejs/kit';
import type { OutfitItemInput } from './outfits';

// Valideert + normaliseert de layout-array uit een request. Gooit 400 bij onzin.
export function parseLayout(raw: unknown): OutfitItemInput[] {
  if (!Array.isArray(raw)) error(400, 'items moet een array zijn');
  return raw.map((r, i) => {
    if (!r || typeof r !== 'object') error(400, `item ${i} ongeldig`);
    const o = r as Record<string, unknown>;
    const item_id = Number(o.item_id);
    if (!Number.isInteger(item_id) || item_id <= 0) error(400, `item ${i}: ongeldig item_id`);
    const num = (v: unknown, def: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };
    return {
      item_id,
      x: num(o.x, 0),
      y: num(o.y, 0),
      scale: num(o.scale, 1),
      rotation: num(o.rotation, 0),
      z_index: Math.trunc(num(o.z_index, i))
    };
  });
}
