import { beforeEach, describe, expect, it } from 'vitest';
import { stack } from './stack.svelte';

describe('stack', () => {
  beforeEach(() => stack.clear());

  it('voegt toe en is idempotent', () => {
    stack.add(1);
    stack.add(1);
    stack.add(2);
    expect(stack.ids).toEqual([1, 2]);
    expect(stack.count).toBe(2);
    expect(stack.has(1)).toBe(true);
    expect(stack.has(9)).toBe(false);
  });

  it('verwijdert en toggelt', () => {
    stack.add(1);
    stack.toggle(2); // aan
    stack.toggle(1); // uit
    expect(stack.ids).toEqual([2]);
    stack.remove(2);
    expect(stack.ids).toEqual([]);
  });

  it('addMany dedupeert en behoudt volgorde', () => {
    stack.add(3);
    stack.addMany([3, 4, 5, 4]);
    expect(stack.ids).toEqual([3, 4, 5]);
  });

  it('clear leegt alles', () => {
    stack.addMany([1, 2, 3]);
    stack.clear();
    expect(stack.count).toBe(0);
  });

  it('prune houdt alleen bestaande id’s', () => {
    stack.addMany([1, 2, 3]);
    stack.prune([1, 3, 9]);
    expect(stack.ids).toEqual([1, 3]);
  });
});
