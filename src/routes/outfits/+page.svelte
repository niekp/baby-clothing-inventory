<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<header class="head">
  <h1>Outfits</h1>
  <Button variant="primary" href="/outfits/new"><Icon name="plus" size={18} /> Nieuwe</Button>
</header>

{#if data.outfits.length === 0}
  <div class="empty">
    <p class="muted">Nog geen outfits samengesteld.</p>
    <Button variant="primary" href="/outfits/new"><Icon name="shapes" size={18} /> Maak je eerste outfit</Button>
  </div>
{:else}
  <div class="grid">
    {#each data.outfits as o (o.id)}
      <a class="card" href={`/outfits/${o.id}`}>
        <div class="thumb">
          {#if o.thumb_url}
            <img src={o.thumb_url} alt={o.name} loading="lazy" />
          {:else}
            <span class="ph" aria-hidden="true"><Icon name="shapes" size={48} /></span>
          {/if}
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
    aspect-ratio: 1000 / 1333;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
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
