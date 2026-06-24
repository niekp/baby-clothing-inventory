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

  async function del() {
    if (!confirm('Deze outfit verwijderen?')) return;
    msg = null;
    const res = await fetch(`/api/outfits/${data.outfit.id}`, { method: 'DELETE' });
    if (res.ok) goto('/outfits');
    else msg = 'Verwijderen mislukt';
  }
</script>

<header class="bar">
  <a href="/outfits" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <h1>{data.outfit.name}</h1>
</header>

{#if msg}<p class="err" role="alert">{msg}</p>{/if}

{#if placed.length > 0}
  <OutfitCanvas {placed} readonly />
{:else}
  <p class="muted">Deze outfit heeft geen items meer (mogelijk verwijderd).</p>
{/if}

<div class="actions">
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
