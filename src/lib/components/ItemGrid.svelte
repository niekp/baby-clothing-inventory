<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import { expandSize } from '$lib/config';
  import ItemCard from './ItemCard.svelte';

  let {
    items,
    markers = new Map<string, string[]>()
  }: { items: ItemDTO[]; markers?: Map<string, string[]> } = $props();

  // namen van kinderen op (een component van) de maat; dubbele maat matcht beide
  function markerFor(size: string): string[] | null {
    const names = [...new Set(expandSize(size).flatMap((s) => markers.get(s) ?? []))];
    return names.length ? names : null;
  }
</script>

<div class="grid">
  {#each items as item (item.id)}
    <ItemCard {item} marker={markerFor(item.size)} />
  {/each}
</div>

<style>
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
