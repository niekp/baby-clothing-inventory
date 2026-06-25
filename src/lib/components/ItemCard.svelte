<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import Icon from './Icon.svelte';
  import { stack } from '$lib/client/stack.svelte';
  import { thumbSrc, imgFallback } from '$lib/client/images';

  let {
    item,
    marker = null,
    stackable = false
  }: { item: ItemDTO; marker?: string[] | null; stackable?: boolean } = $props();

  let onStack = $derived(stackable && stack.has(item.id));
</script>

<div class="card" class:marked={marker}>
  <div class="photo">
    {#if thumbSrc(item)}
      <img
        src={thumbSrc(item)}
        class:cut={item.thumb_url || item.cutout_url}
        alt={item.type ?? 'kledingstuk'}
        loading="lazy"
        onerror={(e) => imgFallback(e, item)}
      />
    {:else}
      <div class="ph" aria-hidden="true"><Icon name="shirt" size={40} /></div>
    {/if}
    <!-- navigatie als overlay-link; knop/badges liggen er los bovenop -->
    <a class="link" href={`/items/${item.id}`} aria-label={item.type ?? 'kledingstuk'}></a>
    <span class="size">{item.size}</span>
    <div class="tr">
      {#if item.favorite}<span class="fav" aria-label="favoriet"><Icon name="heart" size={18} fill /></span>{/if}
      {#if stackable}
        <button
          class="stack-btn"
          class:on={onStack}
          onclick={() => stack.toggle(item.id)}
          aria-pressed={onStack}
          aria-label={onStack ? 'Van stapel halen' : 'Op stapel leggen'}
        >
          <Icon name={onStack ? 'check' : 'plus'} size={18} />
        </button>
      {/if}
    </div>
    {#if item.ai_status === 'processing' || item.ai_status === 'working'}
      <span class="status work"><Icon name="loader" size={13} spin /> AI…</span>
    {:else if item.ai_status === 'suggested'}
      <span class="status check"><Icon name="check" size={13} /> controleren</span>
    {:else if item.ai_status === 'failed'}
      <span class="status fail"><Icon name="alert" size={13} /> mislukt</span>
    {/if}
    {#if marker}<span class="marker" title={`Huidige maat van ${marker.join(', ')}`}>{marker.join(', ')}</span>{/if}
  </div>
</div>

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
  /* overlay-link vult de foto; badges liggen erbovenop maar laten taps door */
  .link {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
  .size,
  .status,
  .marker,
  .tr {
    z-index: 2;
  }
  .size,
  .status,
  .marker,
  .fav {
    pointer-events: none;
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
  .tr {
    position: absolute;
    right: var(--space-2);
    top: var(--space-2);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .fav {
    color: #ff5a7a;
    font-size: 18px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .stack-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 0;
    pointer-events: auto;
    cursor: pointer;
  }
  .stack-btn.on {
    background: var(--accent);
    color: var(--accent-ink);
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
