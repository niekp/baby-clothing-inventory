import { photoUrl } from './photos';
import type { AiSuggestions, CutoutStatus, Item, Outfit } from '$lib/types';

// Client-DTO van een outfit: interne wachtrij-velden (photo_orig/cutout_job/cutout_model)
// worden niet meegestuurd; afgeleide URL's + is_photo/cutout_status wél.
export interface OutfitDTO {
  id: number;
  name: string;
  size: string | null;
  thumb_path: string | null;
  created_at: string;
  cutout_status: CutoutStatus; // genormaliseerd (NULL → 'none')
  is_photo: boolean;
  is_sharp: boolean; // cutout via birefnet (scherp) gemaakt
  cutout_busy: boolean; // een cutout-job staat in de wachtrij/loopt
  thumb_url: string | null;
  thumb_small_url: string | null; // kleine webp voor de lijst (foto-outfit)
  orig_download_url: string | null; // bronfoto (foto-outfit) voor de detail-fallback
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
  return {
    id: outfit.id,
    name: outfit.name,
    size: outfit.size,
    thumb_path: outfit.thumb_path,
    created_at: outfit.created_at,
    cutout_status: outfit.cutout_status ?? 'none',
    is_photo: outfit.photo_orig != null,
    is_sharp: outfit.cutout_model === 'birefnet-general',
    cutout_busy: outfit.cutout_job != null,
    thumb_url: photoUrl('outfit', outfit.thumb_path),
    thumb_small_url: outfit.photo_orig ? photoUrl('outfit', `${outfit.id}.webp`) : null,
    orig_download_url: outfit.photo_orig ? photoUrl('outfit_orig', outfit.photo_orig) : null
  };
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
