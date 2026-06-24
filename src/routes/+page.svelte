<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import ItemGrid from '$lib/components/ItemGrid.svelte';
  import FilterSheet from '$lib/components/FilterSheet.svelte';
  import Button from '$lib/components/Button.svelte';
  import { buildItemQuery } from '$lib/filters';
  import type { ItemFilters } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let filterOpen = $state(false);
  let q = $state('');
  // seed/reset het zoekveld alleen als de genavigeerde zoekterm écht wijzigt
  // (niet bij elke invalidateAll), zodat typen niet wordt overschreven.
  let lastSearch: string | undefined;
  $effect(() => {
    if (data.filters.search !== lastSearch) {
      lastSearch = data.filters.search;
      q = data.filters.search ?? '';
    }
  });

  function navigate(f: ItemFilters) {
    const qs = buildItemQuery(f);
    goto(qs ? `/?${qs}` : '/', { keepFocus: true, noScroll: true });
  }

  function submitSearch(e: Event) {
    e.preventDefault();
    navigate({ ...data.filters, search: q.trim() || undefined });
  }

  function applyFilterset(filterJson: string) {
    // filter_json is de canonieke querystring-string
    goto(`/?${filterJson}`, { noScroll: true });
  }

  function toggleSort() {
    navigate({ ...data.filters, sort: data.filters.sort === 'size' ? undefined : 'size' });
  }

  // Actieve filters als verwijderbare chips
  type ActiveChip = { key: string; label: string; remove: () => void };
  let activeChips = $derived.by<ActiveChip[]>(() => {
    const f = data.filters;
    const chips: ActiveChip[] = [];
    const multi = ['size', 'type', 'length', 'season', 'quality', 'color'] as const;
    for (const key of multi) {
      for (const val of f[key] ?? []) {
        chips.push({
          key: `${key}:${val}`,
          label: `${val}`,
          remove: () => navigate({ ...f, [key]: (f[key] ?? []).filter((v) => v !== val) })
        });
      }
    }
    if (f.favorite)
      chips.push({ key: 'favorite', label: '❤︎ favoriet', remove: () => navigate({ ...f, favorite: undefined }) });
    if (f.search)
      chips.push({ key: 'search', label: `"${f.search}"`, remove: () => navigate({ ...f, search: undefined }) });
    return chips;
  });

  let pinned = $derived(data.filtersets.filter((fs) => fs.pinned));

  // maat → kind-namen op die huidige maat (highlight in de kast)
  let childMarkers = $derived.by(() => {
    const m = new Map<string, string[]>();
    for (const c of data.children) {
      if (!c.current_size) continue;
      m.set(c.current_size, [...(m.get(c.current_size) ?? []), c.name]);
    }
    return m;
  });
</script>

<header class="head">
  <form class="search" onsubmit={submitSearch}>
    <input class="input" type="search" placeholder="Zoeken…" bind:value={q} aria-label="Zoeken" />
  </form>
  <Button variant="ghost" onclick={() => (filterOpen = true)}>⚙︎ Filter</Button>
  <Button variant="ghost" onclick={toggleSort}>
    {data.filters.sort === 'size' ? 'Maat' : 'Nieuwste'}
  </Button>
</header>

{#if pinned.length}
  <div class="pins">
    {#each pinned as fs (fs.id)}
      <button class="pin-chip" onclick={() => applyFilterset(fs.filter_json)}>{fs.name}</button>
    {/each}
  </div>
{/if}

{#if data.inboxCount > 0}
  <a class="review-banner" href="/review">
    {data.inboxCount} scan{data.inboxCount === 1 ? '' : 's'} te controleren →
  </a>
{/if}

{#if activeChips.length}
  <div class="active">
    {#each activeChips as chip (chip.key)}
      <button class="active-chip" onclick={chip.remove}>{chip.label} ✕</button>
    {/each}
  </div>
{/if}

{#if data.items.length === 0}
  <div class="empty">
    <p>Nog geen items{activeChips.length ? ' voor dit filter' : ''}.</p>
    <Button variant="primary" href="/scan">📸 Scan je eerste stuk</Button>
  </div>
{:else}
  <ItemGrid items={data.items} markers={childMarkers} />
{/if}

<FilterSheet
  bind:open={filterOpen}
  initial={data.filters}
  filtersets={data.filtersets}
  onapply={navigate}
  onapplyset={applyFilterset}
  onsaved={invalidateAll}
/>

<style>
  .head {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .search {
    flex: 1;
  }
  .pins {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-1);
  }
  .pin-chip {
    border: 1px solid var(--accent);
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 999px;
    padding: var(--space-2) var(--space-3);
    white-space: nowrap;
    font-size: var(--fs-sm);
  }
  .review-banner {
    display: block;
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-3);
    font-weight: 600;
  }
  .active {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .active-chip {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 999px;
    padding: 4px var(--space-3);
    font-size: var(--fs-sm);
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: var(--space-6) var(--space-4);
  }
  .empty :global(.btn) {
    margin-top: var(--space-3);
  }
</style>
