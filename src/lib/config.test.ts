import { describe, expect, it } from 'vitest';
import { expandSize, isSize, sizesMatchingFilter, SIZE_CHIPS, toggleSizePick } from './config';

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

  describe('toggleSizePick', () => {
    it('selecteert een enkele maat vanuit leeg', () => {
      expect(toggleSizePick('', '68')).toBe('68');
    });
    it('wist bij opnieuw tikken op dezelfde enkele maat', () => {
      expect(toggleSizePick('68', '68')).toBe('');
    });
    it('vormt een dubbele maat met de aangrenzende partner', () => {
      expect(toggleSizePick('62', '68')).toBe('62/68');
      expect(toggleSizePick('68', '62')).toBe('62/68');
    });
    it('weigert een niet-standaard paar (wordt nieuwe enkele maat)', () => {
      expect(toggleSizePick('56', '62')).toBe('62'); // 56 hoort bij 50, niet bij 62
    });
    it('reduceert een dubbele maat naar de getikte component', () => {
      expect(toggleSizePick('62/68', '62')).toBe('62');
      expect(toggleSizePick('62/68', '68')).toBe('68');
    });
    it('springt vanuit dubbel naar een losse andere maat', () => {
      expect(toggleSizePick('62/68', '86')).toBe('86');
    });
  });
});
