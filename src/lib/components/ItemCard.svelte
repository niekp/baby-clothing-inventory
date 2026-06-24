<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import Icon from './Icon.svelte';

  let { item, marker = null }: { item: ItemDTO; marker?: string[] | null } = $props();
</script>

<a class="card" class:marked={marker} href={`/items/${item.id}`}>
  <div class="photo">
    {#if item.display_url}
      <img src={item.display_url} alt={item.type ?? 'kledingstuk'} loading="lazy" />
    {:else}
      <div class="ph" aria-hidden="true"><Icon name="shirt" size={40} /></div>
    {/if}
    <span class="size">{item.size}</span>
    {#if item.favorite}<span class="fav" aria-label="favoriet"><Icon name="heart" size={18} fill /></span>{/if}
    {#if item.ai_status === 'suggested'}<span class="dot" aria-label="te reviewen"></span>{/if}
    {#if marker}<span class="marker" title={`Huidige maat van ${marker.join(', ')}`}>{marker.join(', ')}</span>{/if}
  </div>
  {#if item.type}<span class="type">{item.type}</span>{/if}
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .photo {
    position: relative;
    aspect-ratio: 1;
    background: var(--surface-2);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .card.marked .photo {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }
  .marker {
    position: absolute;
    left: var(--space-2);
    bottom: var(--space-2);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 999px;
    max-width: calc(100% - 16px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    opacity: 0.4;
  }
  .size {
    position: absolute;
    left: var(--space-2);
    top: var(--space-2);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-weight: 700;
    font-size: var(--fs-base);
    padding: 2px 8px;
    border-radius: 8px;
  }
  .fav {
    position: absolute;
    right: var(--space-2);
    top: var(--space-2);
    color: #ff5a7a;
    font-size: 18px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .dot {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #fff;
  }
  .type {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    padding-left: 2px;
  }
</style>
