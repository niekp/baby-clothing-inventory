import { describe, expect, it } from 'vitest';
import { expandSize, isSize, sizesMatchingFilter, SIZE_CHIPS } from './config';

describe('maten', () => {
  it('expandSize splitst dubbele maten', () => {
    expect(expandSize('86')).toEqual(['86']);
    expect(expandSize('86/92')).toEqual(['86', '92']);
  });

  it('isSize accepteert enkele én dubbele maten', () => {
    expect(isSize('86')).toBe(true);
    expect(isSize('86/92')).toBe(true);
    expect(isSize('87')).toBe(false);
    expect(isSize('86/99')).toBe(false);
  });

  it('sizesMatchingFilter expandeert gevraagde maten naar overlappende opslag-maten', () => {
    expect(sizesMatchingFilter(['86']).sort()).toEqual(['86', '86/92'].sort());
    expect(sizesMatchingFilter(['92']).sort()).toEqual(['86/92', '92'].sort());
    expect(sizesMatchingFilter(['86/92']).sort()).toEqual(['86', '86/92', '92'].sort());
    expect(sizesMatchingFilter(['50'])).not.toContain('86/92');
  });

  it('SIZE_CHIPS zet een dubbele maat tussen z\'n componenten', () => {
    const i = SIZE_CHIPS.indexOf('86/92');
    expect(SIZE_CHIPS[i - 1]).toBe('86');
    expect(SIZE_CHIPS[i + 1]).toBe('92');
  });
});
