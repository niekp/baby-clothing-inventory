// Vaste lijsten — gedeeld door client en server.

export const SIZES = [50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122, 128] as const;

// Maten als strings (db slaat maat als tekst op) + validatie-helper.
export const SIZE_STRINGS: string[] = SIZES.map(String);
export function isSize(s: string): boolean {
  return SIZE_STRINGS.includes(s);
}
export function isSeason(s: string): boolean {
  return (SEASONS as readonly string[]).includes(s);
}
export function isType(s: string): boolean {
  return (TYPES as readonly string[]).includes(s);
}
export function isLength(s: string): boolean {
  return (LENGTHS as readonly string[]).includes(s);
}
export function isQuality(s: string): boolean {
  return (QUALITIES as readonly string[]).includes(s);
}
export function isColor(s: string): boolean {
  return (COLORS as readonly string[]).includes(s);
}

export const TYPES = [
  'romper',
  'boxpak',
  'broek',
  'shirt/top',
  'trui',
  'jurk',
  'rok',
  'shorts',
  'jas',
  'pyjama',
  'sokken',
  'muts'
] as const;

export const LENGTHS = ['lang', 'kort', 'nvt'] as const;

export const SEASONS = ['zomer', 'winter', 'tussenseizoen', 'allseason'] as const;

export const QUALITIES = ['nieuw', 'goed', 'versleten'] as const;

// Vaste kleur-opties (AI mapt hierop; ook bruikbaar voor filters/swatches).
export const COLORS = [
  'wit',
  'zwart',
  'grijs',
  'beige',
  'bruin',
  'rood',
  'oranje',
  'geel',
  'groen',
  'blauw',
  'paars',
  'roze',
  'multicolor'
] as const;

export const AI_STATUSES = ['none', 'processing', 'working', 'suggested', 'done', 'failed'] as const;

export const CUTOUT_STATUSES = ['none', 'done', 'failed'] as const;
