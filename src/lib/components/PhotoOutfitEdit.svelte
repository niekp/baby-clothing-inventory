<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import SizeChips from './SizeChips.svelte';
  import type { OutfitDTO } from '$lib/server/serialize';

  let { outfit }: { outfit: OutfitDTO } = $props();

  // seed één keer; parent wrapt in {#key outfit.id} zodat een andere outfit remount
  let name = $state(untrack(() => outfit.name));
  let size = $state(untrack(() => outfit.size ?? ''));
  let saving = $state(false);
  let msg = $state<string | null>(null);

  async function save() {
    if (!name.trim()) return;
    saving = true;
    msg = null;
    const res = await fetch(`/api/outfits/${outfit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), size: size || null })
    });
    if (res.ok) goto(`/outfits/${outfit.id}`);
    else {
      msg = 'Opslaan mislukt';
      saving = false;
    }
  }
</script>

<header class="bar">
  <a href={`/outfits/${outfit.id}`} class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <input class="input name" placeholder="Naam outfit" bind:value={name} aria-label="Naam" />
  <Button variant="primary" disabled={!name.trim() || saving} onclick={save}>
    {saving ? '…' : 'Opslaan'}
  </Button>
</header>

{#if msg}<p class="err" role="alert">{msg}</p>{/if}

{#if outfit.thumb_url}
  <div class="preview"><img src={outfit.thumb_url} alt={outfit.name} /></div>
{/if}

<div class="size-field">
  <p class="field-label">Maat (optioneel)</p>
  <SizeChips current={size} onpick={(s) => (size = s)} />
</div>

<style>
  .bar {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .back {
    font-size: var(--fs-xl);
  }
  .name {
    flex: 1;
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .preview {
    display: flex;
    justify-content: center;
  }
  .preview img {
    max-width: 100%;
    max-height: 50vh;
    object-fit: contain;
    border-radius: var(--radius);
  }
  .size-field {
    margin: var(--space-3) 0;
  }
</style>
