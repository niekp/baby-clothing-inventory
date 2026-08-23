<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PhotoCard from '$lib/components/PhotoCard.svelte';
  import { cutoutState, photoCardSources } from '$lib/client/images';
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
      <PhotoCard
        href={`/outfits/${o.id}`}
        label={o.name}
        sources={photoCardSources(o)}
        cutout={cutoutState(o)}
        badge={o.size}
        altFallback="outfit"
      />
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
  .empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
</style>
