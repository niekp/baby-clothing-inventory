import type { Placed } from './outfit-canvas-space';
import type { OutfitItemDTO } from '$lib/server/serialize';

// Zet de layout-items uit een outfit-GET om naar canvas-Placed (gedeeld door
// de view- en edit-pagina). key = index; url valt terug op display of leeg.
export function outfitItemsToPlaced(items: OutfitItemDTO[]): Placed[] {
  return items.map((oi, i) => ({
    key: i,
    item_id: oi.item_id,
    url: oi.item.cutout_url ?? oi.item.display_url ?? '',
    x: oi.x,
    y: oi.y,
    scale: oi.scale,
    rotation: oi.rotation,
    z: oi.z_index
  }));
}
