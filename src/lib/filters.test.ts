import { describe, expect, it } from 'vitest';
import { buildItemQuery, parseItemFilters } from './filters';

describe('parseItemFilters', () => {
  it('parses multi-value comma lists', () => {
    const f = parseItemFilters(new URLSearchParams('size=62,68&type=broek'));
    expect(f.size).toEqual(['62', '68']);
    expect(f.type).toEqual(['broek']);
  });

  it('parses favorite, q, sort', () => {
    const f = parseItemFilters(new URLSearchParams('favorite=1&q=rood&sort=size'));
    expect(f.favorite).toBe(true);
    expect(f.search).toBe('rood');
    expect(f.sort).toBe('size');
  });

  it('ignores empty/blank values', () => {
    const f = parseItemFilters(new URLSearchParams('size=&type=,, '));
    expect(f.size).toBeUndefined();
    expect(f.type).toBeUndefined();
  });

  it('accepts a plain object as well', () => {
    const f = parseItemFilters({ size: ['62', '68'], favorite: 'true' });
    expect(f.size).toEqual(['62', '68']);
    expect(f.favorite).toBe(true);
  });
});

describe('buildItemQuery roundtrip', () => {
  it('serializes back to a canonical querystring', () => {
    const f = { size: ['62', '68'], type: ['broek'], favorite: true, search: 'rood', sort: 'size' as const };
    const qs = buildItemQuery(f);
    expect(parseItemFilters(new URLSearchParams(qs))).toEqual(f);
  });

  it('omits empty filters', () => {
    expect(buildItemQuery({})).toBe('');
  });
});
