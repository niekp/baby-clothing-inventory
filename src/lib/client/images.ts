import type { ItemDTO } from '$lib/server/serialize';

// Voorkeurs-bron voor een item-thumbnail: kleine thumb → cutout → displayfoto.
export function thumbSrc(item: ItemDTO): string | null {
  return item.thumb_url ?? item.cutout_url ?? item.display_url;
}

// onerror-fallback: als de thumb 404't (nog niet gegenereerd), val terug op cutout/displayfoto.
export function imgFallback(e: Event, item: ItemDTO): void {
  const img = e.currentTarget as HTMLImageElement;
  img.onerror = null; // geen loop als de fallback ook faalt
  const fb = item.cutout_url ?? item.display_url;
  if (fb) img.src = fb;
}
