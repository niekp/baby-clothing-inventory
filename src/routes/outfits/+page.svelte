<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let active = $derived(new Set(data.sizeFilter));

  function filterSize(size: string | null) {
    goto(size ? `/outfits?size=${encodeURIComponent(size)}` : '/outfits', { noScroll: true });
  }
</script>

<header class="head">
  <h1>Outfits</h1>
  <div class="actions">
    <Button variant="ghost" href="/outfits/new/photo"><Icon name="camera" size={18} /> Foto</Button>
    <Button variant="primary" href="/outfits/new"><Icon name="plus" size={18} /> Nieuwe</Button>
  </div>
</header>

{#if data.availableSizes.length}
  <div class="sizes">
    <Chip label="alle" selected={active.size === 0} onclick={() => filterSize(null)} />
    {#each data.availableSizes as s (s)}
      <Chip label={s} selected={active.has(s)} onclick={() => filterSize(s)} />
    {/each}
  </div>
{/if}

{#if data.outfits.length === 0}
  <div class="empty">
    <p class="muted">
      {data.sizeFilter.length ? 'Geen outfits voor deze maat.' : 'Nog geen outfits samengesteld.'}
    </p>
    {#if !data.sizeFilter.length}
      <Button variant="primary" href="/outfits/new"><Icon name="shapes" size={18} /> Maak je eerste outfit</Button>
    {/if}
  </div>
{:else}
  <div class="grid">
    {#each data.outfits as o (o.id)}
      {@const src = o.is_photo ? (o.thumb_small_url ?? o.thumb_url) : o.thumb_url}
      <a class="card" href={`/outfits/${o.id}`}>
        <div class="thumb">
          {#if o.is_photo && o.cutout_status !== 'done'}
            <span class="ph" aria-hidden="true">
              {#if o.cutout_status === 'failed'}<Icon name="alert" size={40} />{:else}<Icon name="loader" size={40} spin />{/if}
            </span>
          {:else if src}
            <img
              {src}
              alt={o.name}
              loading="lazy"
              onerror={(e) => {
                // webp-thumb ontbreekt → val terug op de PNG (eenmalig, geen loop)
                const img = e.currentTarget as HTMLImageElement;
                img.onerror = null;
                if (o.thumb_url) img.src = o.thumb_url;
              }}
            />
          {:else}
            <span class="ph" aria-hidden="true"><Icon name="shapes" size={48} /></span>
          {/if}
          {#if o.size}<span class="size">{o.size}</span>{/if}
        </div>
        <span class="name">{o.name}</span>
      </a>
    {/each}
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }
  .head h1 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
  .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  @media (min-width: 600px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }
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
  .thumb .size {
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
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .ph {
    font-size: 48px;
    opacity: 0.4;
  }
  .name {
    font-weight: 600;
    padding-left: 2px;
  }
  .empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
</style>
