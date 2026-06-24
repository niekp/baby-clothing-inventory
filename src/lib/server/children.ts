import { error } from '@sveltejs/kit';
import { isSingleSize } from '$lib/config';

// Normaliseer + valideer een kind-matenlijst (enkel losse maten, ontdubbeld).
export function parseChildSizes(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) error(400, 'Ongeldige maten');
  const sizes = [...new Set(raw.map(String))];
  if (!sizes.every(isSingleSize)) error(400, 'Ongeldige maat');
  return sizes;
}
