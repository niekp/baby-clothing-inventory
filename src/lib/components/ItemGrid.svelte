<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import ItemCard from './ItemCard.svelte';

  let {
    items,
    markers = new Map<string, string[]>()
  }: { items: ItemDTO[]; markers?: Map<string, string[]> } = $props();
</script>

<div class="grid">
  {#each items as item (item.id)}
    <ItemCard {item} marker={markers.get(item.size) ?? null} />
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
