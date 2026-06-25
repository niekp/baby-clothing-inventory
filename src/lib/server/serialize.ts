import { photoUrl } from './photos';
import type { AiSuggestions, Item, Outfit } from '$lib/types';

export interface OutfitDTO extends Outfit {
  thumb_url: string | null;
}

// Eén layout-item in een outfit-GET (layout-velden + het geserialiseerde item).
export interface OutfitItemDTO {
  id: number;
  item_id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
  item: ItemDTO;
}
export type OutfitWithItemsDTO = OutfitDTO & { items: OutfitItemDTO[] };

export function serializeOutfit(outfit: Outfit): OutfitDTO {
  return { ...outfit, thumb_url: photoUrl('outfit', outfit.thumb_path) };
}

export interface ItemDTO extends Item {
  display_url: string | null;
  cutout_url: string | null;
  thumb_url: string | null; // kleine transparante thumbnail (grids/lijsten)
  orig_download_url: string | null;
  suggestions: AiSuggestions | null;
  seasons: string[]; // geparst uit de season-JSON-kolom
}

// Parse de season-JSON-array defensief (lege/ongeldige waarde → []).
function parseSeasons(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

// Verrijkt een db-Item met afgeleide URL's en geparste AI-suggesties voor de API.
export function serializeItem(item: Item): ItemDTO {
  let suggestions: AiSuggestions | null = null;
  if (item.ai_suggestions) {
    try {
      suggestions = JSON.parse(item.ai_suggestions);
    } catch {
      suggestions = null;
    }
  }
  // BLOB-velden (embedding/kleur-histogram) niet meesturen: groot en nutteloos voor de client
  const { embedding, color_hist, ...rest } = item;
  void embedding;
  void color_hist;
  return {
    ...rest,
    display_url: photoUrl('disp', item.photo_display),
    cutout_url: photoUrl('cutout', item.cutout_path),
    // thumb deelt de basisnaam met de cutout; bestaat alleen als er een cutout is
    thumb_url: item.cutout_path ? photoUrl('thumb', `${item.id}.webp`) : null,
    orig_download_url: item.photo_orig ? `/api/items/${item.id}/original` : null,
    suggestions,
    seasons: parseSeasons(item.season)
  };
}
