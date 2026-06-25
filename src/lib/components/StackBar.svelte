<script lang="ts">
  import { stack } from '$lib/client/stack.svelte';
  import type { ItemDTO } from '$lib/server/serialize';
  import { thumbSrc, imgFallback } from '$lib/client/images';
  import BottomSheet from './BottomSheet.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  let open = $state(false);

  // alle items (ongefilterd) om id's → thumbnails te resolven; (her)laad bij elke opening
  // zodat na het stapelen verschijnen ook tonen
  let items = $state<ItemDTO[]>([]);
  let loadState = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
  $effect(() => {
    if (!open) return;
    loadState = 'loading';
    fetch('/api/items')
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((all: ItemDTO[]) => {
        items = all;
        stack.prune(all.map((i) => i.id)); // dangling id's (verwijderde items) opruimen
        loadState = 'done';
      })
      .catch(() => (loadState = 'error')); // bij fout de stapel NIET legen
  });

  // gestapelde items in stapel-volgorde (mist een thumb tot de fetch klaar is)
  let stacked = $derived(
    stack.ids.map((id) => items.find((i) => i.id === id)).filter((i): i is ItemDTO => !!i)
  );
</script>

{#if stack.count > 0}
  <div class="bar">
    <button class="pill" onclick={() => (open = true)} aria-label="Stapel openen">
      <Icon name="shapes" size={18} />
      Stapel · {stack.count}
    </button>
  </div>
{/if}

<BottomSheet bind:open title="Stapel">
  {#if stack.count === 0}
    <p class="muted">Stapel is leeg.</p>
  {:else if loadState === 'error'}
    <p class="muted">Laden mislukt.</p>
  {:else if stacked.length === 0}
    <p class="muted">Laden…</p>
  {:else}
    <div class="thumbs">
      {#each stacked as item (item.id)}
        {@const thumb = thumbSrc(item)}
        <div class="thumb">
          {#if thumb}<img src={thumb} alt="" onerror={(e) => imgFallback(e, item)} />{:else}<span class="ph"><Icon name="shirt" size={24} /></span>{/if}
          <span class="sz">{item.size}</span>
          <button class="rm" onclick={() => stack.remove(item.id)} aria-label="Van stapel halen">
            <Icon name="x" size={14} />
          </button>
        </div>
      {/each}
    </div>
  {/if}
  <div class="actions">
    <Button variant="ghost" onclick={() => stack.clear()} disabled={stack.count === 0}>
      <Icon name="trash" size={16} /> Leegmaken
    </Button>
    <Button variant="primary" href="/outfits/new" disabled={stack.count === 0}>
      Outfit maken <Icon name="arrow-right" size={16} />
    </Button>
  </div>
</BottomSheet>

<style>
  .bar {
    position: sticky;
    bottom: var(--space-3);
    z-index: 20; /* boven de kaart-overlays (z-index 1/2) */
    display: flex;
    justify-content: center;
    pointer-events: none; /* alleen de pill vangt taps; rest klikt door */
    margin-top: var(--space-4);
  }
  .pill {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    color: var(--accent-ink);
    border: none;
    border-radius: 999px;
    padding: var(--space-3) var(--space-5);
    font-weight: 600;
    font-size: var(--fs-base);
    box-shadow: var(--shadow-2);
    cursor: pointer;
  }
  .thumbs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .thumb {
    position: relative;
    aspect-ratio: 1;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .thumb .ph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    opacity: 0.5;
  }
  .thumb .sz {
    position: absolute;
    left: 2px;
    bottom: 2px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    padding: 0 4px;
    border-radius: 4px;
  }
  .rm {
    position: absolute;
    right: 2px;
    top: 2px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 0;
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    justify-content: space-between;
  }
</style>
