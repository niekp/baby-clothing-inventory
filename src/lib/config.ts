// Vaste lijsten — gedeeld door client en server.

export const SIZES = [44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104, 110, 116, 122, 128] as const;

// Maten als strings (db slaat maat als tekst op).
export const SIZE_STRINGS: string[] = SIZES.map(String);

// Dubbele maten (standaard EU-paren). Een item met een dubbele maat past beide
// losse maten: het matcht filters/Cijfers/kind-highlight voor allebei.
export const COMBINED_SIZES = [
  '50/56',
  '62/68',
  '74/80',
  '86/92',
  '98/104',
  '110/116',
  '122/128'
] as const;

// '86/92' → ['86','92']; '86' → ['86'].
export function expandSize(s: string): string[] {
  return s.split('/');
}

// Sorteersleutel: dubbele maat net ná z'n eerste component (50, 50/56, 56, …).
function sizeSortKey(s: string): number {
  return Number(expandSize(s)[0]) + (s.includes('/') ? 0.5 : 0);
}

// Alle kiesbare/opslaanbare maten (enkel + dubbel) en de chip-volgorde.
export const ALL_SIZES: string[] = [...SIZE_STRINGS, ...COMBINED_SIZES];
export const SIZE_CHIPS: string[] = [...ALL_SIZES].sort((a, b) => sizeSortKey(a) - sizeSortKey(b));

export function isSize(s: string): boolean {
  return ALL_SIZES.includes(s);
}

// Lookups uit de standaard paren: partner-maat (62↔68) en de dubbele maat-string.
const SIZE_PARTNER: Record<string, string> = {};
const SIZE_COMBINED_OF: Record<string, string> = {};
for (const c of COMBINED_SIZES) {
  const [a, b] = expandSize(c);
  SIZE_PARTNER[a] = b;
  SIZE_PARTNER[b] = a;
  SIZE_COMBINED_OF[a] = c;
  SIZE_COMBINED_OF[b] = c;
}

// State-machine voor de maat-kiezer (enkel ↔ dubbel via aangrenzende maten).
// `current`: '' | enkele maat | dubbele maat. `tapped`: altijd een enkele maat.
export function toggleSizePick(current: string, tapped: string): string {
  if (current === tapped) return ''; // enkel opnieuw tikken → wissen
  const parts = current ? expandSize(current) : [];
  if (parts.length === 2) return tapped; // vanuit dubbel → enkel de getikte maat
  if (parts.length === 1 && SIZE_PARTNER[parts[0]] === tapped) return SIZE_COMBINED_OF[tapped]; // vorm dubbel
  return tapped; // nieuwe enkele selectie
}

// Een kind heeft altijd één enkele maat (geen dubbele) als huidige maat.
export function isSingleSize(s: string): boolean {
  return SIZE_STRINGS.includes(s);
}

// Voor het maat-filter: alle opgeslagen maten waarvan een component overlapt met
// een gevraagde maat (zo toont filter '86' ook '86/92').
export function sizesMatchingFilter(wanted: string[]): string[] {
  const components = new Set(wanted.flatMap(expandSize));
  return ALL_SIZES.filter((s) => expandSize(s).some((c) => components.has(c)));
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
  'shirt',
  'trui',
  'jurk',
  'rok',
  'shorts',
  'jas',
  'slaapzak'
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

// Swatch-kleur per optie; 'multicolor' krijgt een gradient in de UI (geen vaste hex).
export const COLOR_HEX: Record<string, string> = {
  wit: '#ffffff',
  zwart: '#222222',
  grijs: '#9ca3af',
  beige: '#e3d2ac',
  bruin: '#8b5a2b',
  rood: '#e23b3b',
  oranje: '#f5912f',
  geel: '#f4d031',
  groen: '#3faa57',
  blauw: '#3b82f6',
  paars: '#8b5cf6',
  roze: '#f48fb1'
};

export const AI_STATUSES = ['none', 'processing', 'working', 'suggested', 'done', 'failed'] as const;

export const CUTOUT_STATUSES = ['none', 'done', 'failed'] as const;
