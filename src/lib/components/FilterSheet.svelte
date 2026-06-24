<script lang="ts">
  import BottomSheet from './BottomSheet.svelte';
  import Chip from './Chip.svelte';
  import Button from './Button.svelte';
  import { SIZES, TYPES, LENGTHS, SEASONS, QUALITIES } from '$lib/config';
  import type { Filterset, ItemFilters } from '$lib/types';

  let {
    open = $bindable(false),
    initial,
    filtersets = [],
    onapply,
    onapplyset,
    onsaved
  }: {
    open?: boolean;
    initial: ItemFilters;
    filtersets?: Filterset[];
    onapply: (f: ItemFilters) => void;
    onapplyset?: (filterJson: string) => void;
    onsaved?: () => void;
  } = $props();

  function applySet(fs: Filterset) {
    onapplyset?.(fs.filter_json);
    open = false;
  }
  async function togglePin(fs: Filterset) {
    await fetch(`/api/filtersets/${fs.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !fs.pinned })
    });
    onsaved?.();
  }
  async function deleteSet(fs: Filterset) {
    await fetch(`/api/filtersets/${fs.id}`, { method: 'DELETE' });
    onsaved?.();
  }

  const GROUPS = [
    { key: 'size' as const, label: 'Maat', options: SIZES.map(String) },
    { key: 'type' as const, label: 'Type', options: [...TYPES] },
    { key: 'length' as const, label: 'Lengte', options: [...LENGTHS] },
    { key: 'season' as const, label: 'Seizoen', options: [...SEASONS] },
    { key: 'quality' as const, label: 'Kwaliteit', options: [...QUALITIES] }
  ];

  type MultiKey = (typeof GROUPS)[number]['key'];
  let sel = $state<Record<MultiKey, string[]>>({
    size: [],
    type: [],
    length: [],
    season: [],
    quality: []
  });
  let fav = $state(false);
  let colorText = $state('');
  let fsName = $state('');
  let fsPin = $state(false);

  // (her)initialiseer de werk-kopie wanneer de sheet opent
  $effect(() => {
    if (open) {
      sel = {
        size: initial.size ?? [],
        type: initial.type ?? [],
        length: initial.length ?? [],
        season: initial.season ?? [],
        quality: initial.quality ?? []
      };
      fav = initial.favorite ?? false;
      colorText = (initial.color ?? []).join(', ');
      fsName = '';
      fsPin = false;
    }
  });

  function toggle(key: MultiKey, value: string) {
    const cur = sel[key];
    sel[key] = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  }

  function build(): ItemFilters {
    const f: ItemFilters = {};
    for (const g of GROUPS) if (sel[g.key].length) f[g.key] = sel[g.key];
    const colors = colorText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (colors.length) f.color = colors;
    if (fav) f.favorite = true;
    if (initial.sort) f.sort = initial.sort;
    return f;
  }

  function apply() {
    onapply(build());
    open = false;
  }

  function reset() {
    sel = { size: [], type: [], length: [], season: [], quality: [] };
    fav = false;
    colorText = '';
  }

  async function saveFilterset() {
    const name = fsName.trim();
    if (!name) return;
    const { buildItemQuery } = await import('$lib/filters');
    const res = await fetch('/api/filtersets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filter: buildItemQuery(build()), pinned: fsPin })
    });
    if (res.ok) {
      fsName = '';
      fsPin = false;
      onsaved?.();
    }
  }
</script>

<BottomSheet bind:open title="Filteren">
  {#each GROUPS as g (g.key)}
    <p class="field-label">{g.label}</p>
    <div class="chips">
      {#each g.options as opt (opt)}
        <Chip label={opt} selected={sel[g.key].includes(opt)} onclick={() => toggle(g.key, opt)} />
      {/each}
    </div>
  {/each}

  <p class="field-label">Kleur</p>
  <input class="input" placeholder="bv. blauw, rood" bind:value={colorText} />

  <label class="fav-row">
    <input type="checkbox" bind:checked={fav} /> Alleen favorieten
  </label>

  <div class="actions">
    <Button variant="ghost" block onclick={reset}>Reset</Button>
    <Button variant="primary" block onclick={apply}>Toepassen</Button>
  </div>

  {#if filtersets.length}
    <div class="saved">
      <p class="field-label">Opgeslagen filtersets</p>
      {#each filtersets as fs (fs.id)}
        <div class="set-row">
          <button class="set-name" onclick={() => applySet(fs)}>{fs.name}</button>
          <button
            class="set-act"
            class:pinned={fs.pinned}
            aria-label={fs.pinned ? 'Losmaken' : 'Vastpinnen'}
            onclick={() => togglePin(fs)}>📌</button
          >
          <button class="set-act" aria-label="Verwijderen" onclick={() => deleteSet(fs)}>✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="save">
    <p class="field-label">Bewaar als filterset</p>
    <div class="save-row">
      <input class="input" placeholder="Naam" bind:value={fsName} />
      <label class="pin"><input type="checkbox" bind:checked={fsPin} /> Pin</label>
      <Button variant="ghost" onclick={saveFilterset} disabled={!fsName.trim()}>Bewaar</Button>
    </div>
  </div>
</BottomSheet>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .fav-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  .actions :global(.btn) {
    flex: 1;
  }
  .saved {
    margin-top: var(--space-4);
    border-top: 1px solid var(--border);
    padding-top: var(--space-2);
  }
  .set-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .set-name {
    flex: 1;
    text-align: left;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-3);
  }
  .set-act {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: var(--radius);
    width: 38px;
    height: 38px;
    opacity: 0.5;
  }
  .set-act.pinned {
    opacity: 1;
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .save {
    margin-top: var(--space-4);
    border-top: 1px solid var(--border);
    padding-top: var(--space-2);
  }
  .save-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .save-row .input {
    flex: 1;
  }
  .pin {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--fs-sm);
    white-space: nowrap;
  }
</style>
