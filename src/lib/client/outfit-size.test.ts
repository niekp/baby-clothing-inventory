import { describe, expect, it } from 'vitest';
import { mostCommonSize } from './outfit-size';

describe('mostCommonSize', () => {
  it('is empty for no items', () => {
    expect(mostCommonSize([])).toBe('');
  });

  it('returns the single size', () => {
    expect(mostCommonSize(['68'])).toBe('68');
  });

  it('returns the strict majority size', () => {
    expect(mostCommonSize(['68', '68', '74'])).toBe('68');
  });

  it('is empty on a tie for first place', () => {
    expect(mostCommonSize(['68', '74'])).toBe('');
    expect(mostCommonSize(['68', '68', '74', '74'])).toBe('');
  });
});
