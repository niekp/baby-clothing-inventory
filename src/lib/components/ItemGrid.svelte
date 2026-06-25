<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import { TYPES, SIZE_CHIPS } from '$lib/config';
  import ItemCard from './ItemCard.svelte';

  let {
    items,
    stackable = false,
    grouped = false
  }: { items: ItemDTO[]; stackable?: boolean; grouped?: boolean } = $props();

  // sorteersleutels: onbekende maat/type achteraan
  const sizeIdx = (s: string) => {
    const i = SIZE_CHIPS.indexOf(s);
    return i < 0 ? Infinity : i;
  };
  const typeIdx = (t: string) => {
    const i = (TYPES as readonly string[]).indexOf(t);
    return i < 0 ? Infinity : i;
  };

  // gegroepeerd op type (TYPES-volgorde), binnen elke groep op maat oplopend
  let groups = $derived.by(() => {
    if (!grouped) return null;
    const map = new Map<string, ItemDTO[]>();
    for (const it of items) {
      const key = it.type ?? '';
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return [...map.entries()]
      .sort((a, b) => typeIdx(a[0]) - typeIdx(b[0]))
      .map(([type, its]) => ({
        type,
        label: type || 'Overig',
        items: [...its].sort((x, y) => sizeIdx(x.size) - sizeIdx(y.size))
      }));
  });
</script>

{#if groups}
  {#each groups as g (g.type)}
    <section class="group">
      <h2 class="group-title">{g.label}</h2>
      <div class="grid">
        {#each g.items as item (item.id)}
          <ItemCard {item} {stackable} />
        {/each}
      </div>
    </section>
  {/each}
{:else}
  <div class="grid">
    {#each items as item (item.id)}
      <ItemCard {item} {stackable} />
    {/each}
  </div>
{/if}

<style>
  .group {
    margin-bottom: var(--space-5);
  }
  .group-title {
    font-size: var(--fs-base);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: capitalize;
    margin: 0 0 var(--space-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  @media (min-width: 480px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }
  }
</style>
