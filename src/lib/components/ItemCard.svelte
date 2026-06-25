<script lang="ts">
  import type { ItemDTO } from '$lib/server/serialize';
  import Icon from './Icon.svelte';
  import { stack } from '$lib/client/stack.svelte';
  import { thumbSrc, imgFallback } from '$lib/client/images';

  let {
    item,
    stackable = false
  }: { item: ItemDTO; stackable?: boolean } = $props();

  // stapel-modus: kaart-tik = toevoegen i.p.v. navigeren
  let selecting = $derived(stackable && stack.active);
  let onStack = $derived(stackable && stack.has(item.id));
</script>

<div class="card" class:selected={selecting && onStack}>
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
    <!-- overlay vult de foto: navigatie, of in stapel-modus een toggle -->
    {#if selecting}
      <button
        class="link"
        onclick={() => stack.toggle(item.id)}
        aria-pressed={onStack}
        aria-label={onStack ? 'Van stapel halen' : 'Op stapel leggen'}
      ></button>
    {:else}
      <a class="link" href={`/items/${item.id}`} aria-label={item.type ?? 'kledingstuk'}></a>
    {/if}
    <span class="size">{item.size}</span>
    <div class="tr">
      {#if item.favorite}<span class="fav" aria-label="favoriet"><Icon name="heart" size={18} fill /></span>{/if}
      {#if selecting && onStack}<span class="check"><Icon name="check" size={18} /></span>{/if}
    </div>
    {#if item.ai_status === 'processing' || item.ai_status === 'working'}
      <span class="status work"><Icon name="loader" size={13} spin /> AI…</span>
    {:else if item.ai_status === 'suggested'}
      <span class="status check"><Icon name="check" size={13} /> controleren</span>
    {:else if item.ai_status === 'failed'}
      <span class="status fail"><Icon name="alert" size={13} /> mislukt</span>
    {/if}
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
  .card.selected .photo {
    outline: 3px solid var(--accent);
    outline-offset: -3px;
  }
  /* overlay vult de foto; badges liggen erbovenop maar laten taps door */
  .link {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .size,
  .status,
  .tr {
    z-index: 2;
  }
  .size,
  .status,
  .fav,
  .check {
    pointer-events: none;
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
  .check {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
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
