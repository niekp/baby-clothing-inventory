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

export const TYPES = [
  'romper',
  'body',
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

export const AI_STATUSES = ['none', 'processing', 'working', 'suggested', 'done', 'failed'] as const;

export const CUTOUT_STATUSES = ['none', 'done', 'failed'] as const;
