<script lang="ts">
  import { goto } from '$app/navigation';
  import OutfitCanvas from '$lib/components/OutfitCanvas.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { outfitItemsToPlaced } from '$lib/client/outfit-placed';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let placed = $derived(outfitItemsToPlaced(data.outfit.items));

  let msg = $state<string | null>(null);
  let sharpening = $state(false);

  async function del() {
    if (!confirm('Deze outfit verwijderen?')) return;
    msg = null;
    const res = await fetch(`/api/outfits/${data.outfit.id}`, { method: 'DELETE' });
    if (res.ok) goto('/outfits');
    else msg = 'Verwijderen mislukt';
  }

  async function sharpen() {
    sharpening = true;
    msg = null;
    const res = await fetch(`/api/outfits/${data.outfit.id}/recutout`, { method: 'POST' });
    sharpening = false;
    if (res.ok) msg = 'Scherpere cutout in de wachtrij…';
    else msg = 'Verscherpen mislukt';
  }
</script>

<header class="bar">
  <a href="/outfits" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <h1>{data.outfit.name}</h1>
  {#if data.outfit.size}<span class="size">{data.outfit.size}</span>{/if}
</header>

{#if msg}<p class="err" role="alert">{msg}</p>{/if}

{#if data.outfit.is_photo}
  {#if data.outfit.cutout_status === 'done' && data.outfit.thumb_url}
    <div class="photo"><img src={data.outfit.thumb_url} alt={data.outfit.name} /></div>
  {:else if data.outfit.cutout_status === 'failed'}
    <div class="photo state">
      {#if data.outfit.orig_download_url}<img src={data.outfit.orig_download_url} alt={data.outfit.name} />{/if}
      <p class="badge fail"><Icon name="alert" size={14} /> Cutout mislukt — originele foto getoond</p>
    </div>
  {:else}
    <div class="photo state">
      {#if data.outfit.orig_download_url}<img src={data.outfit.orig_download_url} alt={data.outfit.name} />{/if}
      <p class="badge work"><Icon name="loader" size={14} spin /> Cutout wordt gemaakt…</p>
    </div>
  {/if}
{:else if placed.length > 0}
  <OutfitCanvas {placed} readonly />
{:else}
  <p class="muted">Deze outfit heeft geen items meer (mogelijk verwijderd).</p>
{/if}

<div class="actions">
  {#if data.outfit.is_photo && !data.outfit.is_sharp && !data.outfit.cutout_busy}
    <Button variant="ghost" onclick={sharpen} disabled={sharpening}>
      <Icon name="loader" size={16} spin={sharpening} /> Scherpere cutout
    </Button>
  {/if}
  <Button variant="ghost" href={`/outfits/${data.outfit.id}/edit`}
    ><Icon name="pencil" size={16} /> Bewerken</Button
  >
  <Button variant="danger" onclick={del}><Icon name="trash" size={16} /> Verwijderen</Button>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .bar h1 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .size {
    background: var(--surface-2);
    color: var(--text);
    font-weight: 700;
    font-size: var(--fs-sm);
    padding: 2px 10px;
    border-radius: 999px;
  }
  .back {
    font-size: var(--fs-xl);
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
    margin-top: var(--space-4);
  }
  .photo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .photo img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: var(--radius);
  }
  .photo.state img {
    opacity: 0.6;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-sm);
    border-radius: 999px;
    padding: var(--space-2) var(--space-3);
  }
  .badge.work {
    background: var(--surface-2);
    color: var(--text-muted);
  }
  .badge.fail {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }
</style>
