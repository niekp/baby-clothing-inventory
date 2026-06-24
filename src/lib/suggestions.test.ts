import { describe, expect, it } from 'vitest';
import { suggestionPatch } from './suggestions';

describe('suggestionPatch', () => {
  const empty = { type: null, color: null, length: null, seasons: [] };

  it('fills all empty fields (season → seasons-array)', () => {
    const patch = suggestionPatch(empty, {
      type: 'broek',
      color: 'blauw',
      length: 'lang',
      season: 'zomer'
    });
    expect(patch).toEqual({ type: 'broek', color: 'blauw', length: 'lang', seasons: ['zomer'] });
  });

  it('never overwrites a manually-set field', () => {
    const patch = suggestionPatch(
      { type: 'jurk', color: null, length: null, seasons: [] },
      { type: 'broek', color: 'rood' }
    );
    expect(patch).toEqual({ color: 'rood' }); // type behouden
  });

  it('does not set seasons when the item already has one', () => {
    const patch = suggestionPatch(
      { type: null, color: null, length: null, seasons: ['winter'] },
      { season: 'zomer' }
    );
    expect(patch.seasons).toBeUndefined(); // handmatige seizoenen winnen
  });

  it('ignores missing suggestion fields', () => {
    expect(suggestionPatch(empty, { type: 'trui' })).toEqual({ type: 'trui' });
  });

  it('returns empty patch for null suggestions', () => {
    expect(suggestionPatch(empty, null)).toEqual({});
  });

  it('returns empty patch when everything is already set', () => {
    const item = { type: 'broek', color: 'blauw', length: 'lang', seasons: ['zomer'] };
    expect(suggestionPatch(item, { type: 'jurk', color: 'rood', season: 'winter' })).toEqual({});
  });
});
