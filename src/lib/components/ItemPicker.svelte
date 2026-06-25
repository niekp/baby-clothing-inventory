<script lang="ts">
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import type { ItemDTO } from '$lib/server/serialize';
  import { SIZE_STRINGS } from '$lib/config';

  let { items, onpick }: { items: ItemDTO[]; onpick: (item: ItemDTO) => void } = $props();

  let sizeFilter = $state<string | null>(null);

  // alleen maten die voorkomen, in de vaste volgorde
  let sizes = $derived(SIZE_STRINGS.filter((s) => items.some((i) => i.size === s)));
  let filtered = $derived(sizeFilter ? items.filter((i) => i.size === sizeFilter) : items);
</script>

<div class="picker">
  <p class="field-label">Tik om toe te voegen</p>
  {#if items.length === 0}
    <p class="muted">Nog geen items om te combineren.</p>
  {:else}
    {#if sizes.length > 1}
      <div class="sizes">
        <Chip label="alle" selected={sizeFilter === null} onclick={() => (sizeFilter = null)} />
        {#each sizes as s (s)}
          <Chip label={s} selected={sizeFilter === s} onclick={() => (sizeFilter = s)} />
        {/each}
      </div>
    {/if}
    <div class="strip">
      {#each filtered as item (item.id)}
        {@const thumb = item.thumb_url || item.cutout_url || item.display_url}
        <button class="pick" onclick={() => onpick(item)} aria-label={`Voeg ${item.type ?? 'item'} maat ${item.size} toe`}>
          {#if thumb}
            <img src={thumb} alt="" />
          {:else}
            <span class="ph"><Icon name="shirt" size={28} /></span>
          {/if}
          <span class="sz">{item.size}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .strip {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding-bottom: var(--space-2);
  }
  .pick {
    position: relative;
    flex: 0 0 auto;
    width: 72px;
    height: 72px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    padding: 0;
    overflow: hidden;
  }
  .pick img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .pick .ph {
    font-size: 28px;
    opacity: 0.5;
  }
  .pick .sz {
    position: absolute;
    left: 2px;
    bottom: 2px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    padding: 0 4px;
    border-radius: 4px;
  }
</style>
