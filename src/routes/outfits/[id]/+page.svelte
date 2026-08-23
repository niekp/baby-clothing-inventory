<script lang="ts">
  import { goto } from '$app/navigation';
  import OutfitCanvas from '$lib/components/OutfitCanvas.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PhotoCutoutView from '$lib/components/PhotoCutoutView.svelte';
  import { cutoutState } from '$lib/client/images';
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
  <PhotoCutoutView
    cutout={cutoutState(data.outfit)}
    label={data.outfit.name}
    cutoutUrl={data.outfit.thumb_url}
    originalUrl={data.outfit.orig_download_url}
  />
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
  {#if data.outfit.kind === 'own'}
    <Button variant="ghost" href={`/outfits/${data.outfit.id}/edit`}
      ><Icon name="pencil" size={16} /> Bewerken</Button
    >
  {/if}
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
</style>
