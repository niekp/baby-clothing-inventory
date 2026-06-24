<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import Icon from './Icon.svelte';

  let { item, marker = null }: { item: ItemDTO; marker?: string[] | null } = $props();
</script>

<a class="card" class:marked={marker} href={`/items/${item.id}`}>
  <div class="photo">
    {#if item.cutout_url || item.display_url}
      <!-- cutout (vrijstaand, geen achtergrond-ruis) heeft voorkeur; anders de displayfoto -->
      <img
        src={item.cutout_url ?? item.display_url}
        class:cut={item.cutout_url}
        alt={item.type ?? 'kledingstuk'}
        loading="lazy"
      />
    {:else}
      <div class="ph" aria-hidden="true"><Icon name="shirt" size={40} /></div>
    {/if}
    <span class="size">{item.size}</span>
    {#if item.favorite}<span class="fav" aria-label="favoriet"><Icon name="heart" size={18} fill /></span>{/if}
    {#if item.ai_status === 'processing' || item.ai_status === 'working'}
      <span class="status work"><Icon name="loader" size={13} spin /> AI…</span>
    {:else if item.ai_status === 'suggested'}
      <span class="status check"><Icon name="check" size={13} /> controleren</span>
    {:else if item.ai_status === 'failed'}
      <span class="status fail"><Icon name="alert" size={13} /> mislukt</span>
    {/if}
    {#if marker}<span class="marker" title={`Huidige maat van ${marker.join(', ')}`}>{marker.join(', ')}</span>{/if}
  </div>
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
  /* cutout: heel tonen i.p.v. croppen (vrijstaand kledingstuk) */
  .photo img.cut {
    object-fit: contain;
    padding: var(--space-2);
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
  .status {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    color: #fff;
  }
  .status.work {
    background: rgba(0, 0, 0, 0.7);
  }
  .status.check {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .status.fail {
    background: var(--danger);
  }
</style>
