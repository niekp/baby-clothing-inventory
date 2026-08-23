export type AiStatus = 'none' | 'processing' | 'working' | 'suggested' | 'done' | 'failed';
export type CutoutStatus = 'none' | 'done' | 'failed';

export interface AiSuggestions {
  type?: string;
  color?: string;
  length?: string;
  season?: string; // AI suggereert één seizoen; bij overname → seasons:[season] (zie suggestionPatch)
}

export interface Item {
  id: number;
  size: string;
  type: string | null;
  length: string | null;
  season: string | null;
  quality: string | null;
  favorite: number; // 0/1
  color: string | null;
  note: string | null;
  photo_orig: string | null;
  photo_display: string | null;
  ai_status: AiStatus;
  ai_suggestions: string | null; // JSON
  cutout_path: string | null;
  cutout_status: CutoutStatus;
  cutout_model: string | null; // model van de huidige cutout: 'birefnet-general' = scherp, else niet-scherp
  cutout_job: string | null; // cutout-wachtrij: 'queued:<model>' / 'working:<model>' / null
  created_at: string;
  embedding?: Buffer | null; // CLIP-vector (BLOB); server-only, niet naar de client
  color_hist?: Buffer | null; // kleur-histogram (BLOB); server-only
}

export interface Child {
  id: number;
  name: string;
  current_sizes: string[];
}

export interface Filterset {
  id: number;
  name: string;
  filter_json: string;
  pinned: number; // 0/1
}

// Soort outfit: zelf samengesteld/eigen foto, of een inspiratie-printscreen van internet.
export type OutfitKind = 'own' | 'inspiration';

export interface Outfit {
  id: number;
  kind: OutfitKind;
  name: string; // '' voor inspiratie (kolom is NOT NULL; UI toont de notitie)
  note: string | null; // alleen voor inspiratie
  favorite: number; // 0/1; alleen voor inspiratie
  size: string | null;
  thumb_path: string | null;
  photo_orig: string | null; // foto-outfit bronfoto (<id>.<ext> in outfit_orig); NULL = item-outfit
  cutout_status: CutoutStatus | null; // NULL telt als 'none' (kolom heeft geen DEFAULT)
  cutout_model: string | null; // 'birefnet-general' = scherp; else niet-scherp
  cutout_job: string | null; // cutout-wachtrij: 'queued:<model>' / 'working:<model>' / null
  created_at: string;
}

export interface OutfitItem {
  id: number;
  outfit_id: number;
  item_id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
}

// Velden waarop de kast/list-API filtert (canonieke querystring → dit object).
export interface ItemFilters {
  size?: string[];
  type?: string[];
  length?: string[];
  season?: string[];
  quality?: string[];
  color?: string[];
  favorite?: boolean;
  search?: string;
  sort?: 'newest' | 'size';
  ai_status?: string[]; // intern filter (niet in de canonieke querystring)
}

// Eén item-plaatsing in een outfit-layout (client → outfit-API).
export interface OutfitLayoutInput {
  item_id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
}

// Velden die bij create/update gezet mogen worden.
export interface ItemInput {
  size: string;
  type?: string | null;
  length?: string | null;
  seasons?: string[]; // meerdere seizoenen per item (opgeslagen als JSON-array)
  quality?: string | null;
  favorite?: number;
  color?: string | null;
  note?: string | null;
  photo_orig?: string | null;
  photo_display?: string | null;
  ai_status?: AiStatus;
}
