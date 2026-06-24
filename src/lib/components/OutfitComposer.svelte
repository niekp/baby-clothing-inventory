<script lang="ts">
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import OutfitCanvas from './OutfitCanvas.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import { W, H, type Placed } from '$lib/client/outfit-canvas-space';
  import { renderOutfitThumb } from '$lib/client/outfit-thumb';
  import type { ItemDTO } from '$lib/server/serialize';
  import type { OutfitLayoutInput } from '$lib/types';

  let {
    items,
    initialName = '',
    initialPlaced = [],
    onsave
  }: {
    items: ItemDTO[];
    initialName?: string;
    initialPlaced?: Placed[];
    onsave: (name: string, layout: OutfitLayoutInput[]) => Promise<number | null>;
  } = $props();

  // seed lokale state één keer uit de props (composer remount per pagina)
  let name = $state(untrack(() => initialName));
  let placed = $state<Placed[]>(untrack(() => [...initialPlaced]));
  let selectedKey = $state<number | null>(null);
  let saving = $state(false);
  let msg = $state<string | null>(null);
  let keySeq = untrack(() => initialPlaced.reduce((m, p) => Math.max(m, p.key + 1), 0));

  const maxZ = () => placed.reduce((m, p) => Math.max(m, p.z), 0);
  const minZ = () => placed.reduce((m, p) => Math.min(m, p.z), 0);

  function add(item: ItemDTO) {
    const key = keySeq++;
    placed = [
      ...placed,
      {
        key,
        item_id: item.id,
        url: item.cutout_url ?? item.display_url ?? '',
        x: W / 2,
        y: H / 2,
        scale: 1,
        rotation: 0,
        z: maxZ() + 1
      }
    ];
    if (!item.cutout_url) void recutout(item.id, key); // cutout ontbreekt → on-demand maken
  }

  async function recutout(itemId: number, key: number) {
    try {
      const res = await fetch(`/api/items/${itemId}/recutout`, { method: 'POST' });
      if (!res.ok) return;
      const updated = (await res.json()) as ItemDTO;
      if (updated.cutout_url) {
        placed = placed.map((p) => (p.key === key ? { ...p, url: updated.cutout_url! } : p));
      }
    } catch {
      /* placeholder/display blijft staan */
    }
  }

  function mutateSelected(patch: Partial<Placed>) {
    if (selectedKey == null) return;
    placed = placed.map((p) => (p.key === selectedKey ? { ...p, ...patch } : p));
  }
  const bringFront = () => mutateSelected({ z: maxZ() + 1 });
  const sendBack = () => mutateSelected({ z: minZ() - 1 });
  function removeSelected() {
    placed = placed.filter((p) => p.key !== selectedKey);
    selectedKey = null;
  }

  async function save() {
    if (!name.trim() || placed.length === 0) return;
    saving = true;
    msg = null;
    const layout: OutfitLayoutInput[] = placed.map((p) => ({
      item_id: p.item_id,
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: p.rotation,
      z_index: p.z
    }));
    const id = await onsave(name.trim(), layout);
    if (id == null) {
      msg = 'Opslaan mislukt';
      saving = false;
      return;
    }
    // thumbnail (best-effort; outfit bestaat ook zonder)
    try {
      const blob = await renderOutfitThumb(placed);
      await fetch(`/api/outfits/${id}/thumb`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: blob
      });
    } catch {
      /* niet kritiek */
    }
    goto(`/outfits/${id}`);
  }
</script>

<header class="bar">
  <a href="/outfits" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <input class="input name" placeholder="Naam outfit" bind:value={name} aria-label="Naam" />
  <Button variant="primary" disabled={!name.trim() || placed.length === 0 || saving} onclick={save}>
    {saving ? '…' : 'Opslaan'}
  </Button>
</header>

{#if msg}<p class="err" role="alert">{msg}</p>{/if}

<OutfitCanvas bind:placed bind:selectedKey />

{#if selectedKey != null}
  <div class="tools">
    <Button variant="ghost" onclick={bringFront}><Icon name="arrow-up" size={16} /> Voor</Button>
    <Button variant="ghost" onclick={sendBack}><Icon name="arrow-down" size={16} /> Achter</Button>
    <Button variant="danger" onclick={removeSelected}><Icon name="trash" size={16} /> Verwijder</Button>
  </div>
{/if}

<ItemPicker {items} onpick={add} />

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
  .tools {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
    margin: var(--space-3) 0;
  }
</style>
