import type { AiSuggestions } from '$lib/types';
import { isColor, isLength, isSeason, isType } from '$lib/config';

// Valideer per veld; ongeldige AI-waarde → undefined (wordt niet overgenomen).
const VALID = { type: isType, color: isColor, length: isLength } as const;

// Resultaat van overname: te PATCHen velden (season → seasons-array).
export interface SuggestionApply {
  type?: string;
  color?: string;
  length?: string;
  seasons?: string[];
}

interface ItemForMerge {
  type: string | null;
  color: string | null;
  length: string | null;
  seasons: string[];
}

// Overname-semantiek: vul ALLEEN lege velden uit de AI-suggesties.
// Handmatige keuzes winnen altijd. Geeft de patch terug (kan leeg zijn).
export function suggestionPatch(
  item: ItemForMerge,
  suggestions: AiSuggestions | null | undefined
): SuggestionApply {
  const patch: SuggestionApply = {};
  if (!suggestions) return patch;
  for (const k of ['type', 'color', 'length'] as const) {
    const val = suggestions[k];
    if (val && !item[k] && VALID[k](val)) patch[k] = val;
  }
  // AI suggereert één seizoen; alleen invullen als er nog geen seizoenen zijn.
  if (suggestions.season && isSeason(suggestions.season) && item.seasons.length === 0)
    patch.seasons = [suggestions.season];
  return patch;
}
