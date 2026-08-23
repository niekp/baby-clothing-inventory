import type { ItemDTO, OutfitDTO } from '$lib/server/serialize';

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

export type CutoutView = 'ready' | 'busy' | 'failed';

// Cutout-toestand van een foto-outfit of inspiratie-plaatje. Een canvas-outfit heeft
// geen bronfoto en dus geen cutout-toestand.
export function cutoutState(o: OutfitDTO): CutoutView {
  if (!o.is_photo || o.cutout_status === 'done') return 'ready';
  return o.cutout_status === 'failed' ? 'failed' : 'busy';
}

// Kaartbronnen in voorkeursvolgorde. Zonder geslaagde cutout meteen het origineel: de
// cutout-URL's bestaan dan nog niet op schijf, en een onerror-terugval vuurt bij het
// SSR-laden vóórdat de handler eraan hangt.
export function photoCardSources(o: OutfitDTO): string[] {
  if (!o.is_photo) return o.thumb_url ? [o.thumb_url] : [];
  const chain =
    o.cutout_status === 'done'
      ? [o.thumb_small_url, o.thumb_url, o.orig_download_url]
      : [o.orig_download_url];
  return chain.filter((url): url is string => !!url);
}
