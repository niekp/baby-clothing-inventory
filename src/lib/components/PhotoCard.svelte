<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';
  import type { CutoutView } from '$lib/client/images';

  let {
    href,
    label,
    sources,
    cutout = 'ready',
    badge = null,
    favorite = false,
    altFallback = 'foto',
    placeholderIcon = 'shapes'
  }: {
    href: string;
    label: string;
    sources: string[];
    cutout?: CutoutView;
    badge?: string | null;
    favorite?: boolean;
    altFallback?: string;
    placeholderIcon?: IconName;
  } = $props();

  // loopt de bronnen af als er één 404't (thumb nog niet gegenereerd)
  let tried = $state(0);
  let src = $derived(sources[tried] ?? null);

  // op inhoud vergelijken, niet op array-identiteit: de ouder maakt bij elke render een
  // nieuwe lijst, en resetten daarop zou een geslaagde terugval telkens ongedaan maken
  let chain = $derived(sources.join('|'));
  $effect(() => {
    chain;
    tried = 0;
  });

  function nextSource() {
    if (tried < sources.length - 1) tried += 1;
  }
</script>

<a class="card" {href}>
  <div class="thumb">
    {#if cutout === 'busy'}
      <!-- geen beeld: de enige bron zou het volledige origineel zijn -->
      <span class="ph" aria-hidden="true"><Icon name="loader" size={40} spin /></span>
    {:else if src}
      <img {src} class:pending={cutout === 'failed'} alt={label || altFallback} loading="lazy" onerror={nextSource} />
    {:else if cutout === 'failed'}
      <span class="ph" aria-hidden="true"><Icon name="alert" size={40} /></span>
    {:else}
      <span class="ph" aria-hidden="true"><Icon name={placeholderIcon} size={48} /></span>
    {/if}
    {#if badge}<span class="badge">{badge}</span>{/if}
    {#if favorite}
      <span class="fav" aria-label="favoriet"><Icon name="heart" size={18} fill /></span>
    {/if}
    {#if src && cutout === 'failed'}
      <span class="status fail"><Icon name="alert" size={13} /> cutout mislukt</span>
    {/if}
  </div>
  <span class="name">{label}</span>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .thumb {
    position: relative;
    aspect-ratio: 1000 / 1333;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .badge {
    position: absolute;
    left: var(--space-2);
    top: var(--space-2);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-weight: 700;
    font-size: var(--fs-sm);
    padding: 2px 8px;
    border-radius: 8px;
  }
  .fav {
    position: absolute;
    right: var(--space-2);
    top: var(--space-2);
    color: #ff5a7a;
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
    padding: 2px 6px;
    border-radius: 8px;
  }
  .status.fail {
    background: color-mix(in srgb, var(--danger) 85%, #000);
    color: #fff;
  }
  .badge,
  .fav,
  .status {
    pointer-events: none;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  /* origineel i.p.v. cutout: gedempt zodat de badge leest als 'niet gelukt' */
  .thumb img.pending {
    opacity: 0.6;
  }
  .ph {
    font-size: 48px;
    opacity: 0.4;
  }
  .name {
    font-weight: 600;
    padding-left: 2px;
  }
</style>
