<script lang="ts" module>
  // Bewerkbare eigenschappen van een item — gedeeld door item-detail en de review-kaart.
  export interface ItemFormValue {
    size: string;
    type: string;
    length: string;
    seasons: string[];
    quality: string;
    color: string;
    note: string;
  }
  export function blankForm(): ItemFormValue {
    return { size: '', type: '', length: '', seasons: [], quality: '', color: '', note: '' };
  }
</script>

<script lang="ts">
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import SizeChips from './SizeChips.svelte';
  import { TYPES, LENGTHS, SEASONS, QUALITIES } from '$lib/config';

  let {
    value = $bindable(),
    showNote = true
  }: { value: ItemFormValue; showNote?: boolean } = $props();

  // ingeklapt tot waarde; één rij tegelijk open
  let openKey = $state<string>('');
  const toggle = (k: string) => (openKey = openKey === k ? '' : k);

  // single-select (opnieuw tikken wist)
  function pick(key: 'type' | 'length' | 'quality', val: string) {
    value[key] = value[key] === val ? '' : val;
  }
  // seizoenen multi-select; 'allseason' is een wederzijds-uitsluitende snelkoppeling
  function toggleSeason(s: string) {
    if (s === 'allseason') {
      value.seasons = value.seasons.includes('allseason') ? [] : ['allseason'];
      return;
    }
    const without = value.seasons.filter((x) => x !== 'allseason');
    value.seasons = without.includes(s) ? without.filter((x) => x !== s) : [...without, s];
  }
</script>

{#snippet head(key: string, label: string, val: string)}
  <button type="button" class="row-head" aria-expanded={openKey === key} onclick={() => toggle(key)}>
    <span class="rl">{label}</span>
    <span class="rv" class:empty={!val}>{val || '—'}</span>
    <span class="chev"><Icon name="chevron-down" size={18} /></span>
  </button>
{/snippet}

<div class="fields">
  <div class="row">
    {@render head('size', 'Maat', value.size)}
    {#if openKey === 'size'}
      <div class="body"><SizeChips current={value.size} onpick={(s) => (value.size = s)} /></div>
    {/if}
  </div>

  <div class="row">
    {@render head('type', 'Type', value.type)}
    {#if openKey === 'type'}
      <div class="body chips">
        {#each TYPES as t (t)}
          <Chip label={t} selected={value.type === t} onclick={() => pick('type', t)} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="row">
    {@render head('length', 'Lengte', value.length)}
    {#if openKey === 'length'}
      <div class="body chips">
        {#each LENGTHS as l (l)}
          <Chip label={l} selected={value.length === l} onclick={() => pick('length', l)} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="row">
    {@render head('season', 'Seizoen', value.seasons.join(', '))}
    {#if openKey === 'season'}
      <div class="body chips">
        {#each SEASONS as s (s)}
          <Chip label={s} selected={value.seasons.includes(s)} onclick={() => toggleSeason(s)} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="row">
    {@render head('quality', 'Kwaliteit', value.quality)}
    {#if openKey === 'quality'}
      <div class="body chips">
        {#each QUALITIES as q (q)}
          <Chip label={q} selected={value.quality === q} onclick={() => pick('quality', q)} />
        {/each}
      </div>
    {/if}
  </div>

  <div class="row">
    {@render head('color', 'Kleur', value.color)}
    {#if openKey === 'color'}
      <div class="body"><input class="input" bind:value={value.color} placeholder="bv. blauw" /></div>
    {/if}
  </div>

  {#if showNote}
    <div class="row">
      {@render head('note', 'Notitie', value.note)}
      {#if openKey === 'note'}
        <div class="body"><textarea class="input note" bind:value={value.note} rows="2"></textarea></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .fields {
    border-top: 1px solid var(--border);
  }
  .row {
    border-bottom: 1px solid var(--border);
  }
  .row-head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    background: none;
    border: none;
    padding: var(--space-3) var(--space-1);
    text-align: left;
    cursor: pointer;
  }
  .rl {
    flex: 0 0 5.5rem;
    color: var(--text-muted);
    font-weight: 600;
    font-size: var(--fs-sm);
  }
  .rv {
    flex: 1;
    min-width: 0;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rv.empty {
    color: var(--text-muted);
  }
  .chev {
    display: inline-flex;
    color: var(--text-muted);
    transition: transform 0.15s ease;
  }
  .row-head[aria-expanded='true'] .chev {
    transform: rotate(180deg);
  }
  .body {
    padding: 0 var(--space-1) var(--space-3);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  textarea.note {
    resize: vertical;
    font-family: inherit;
  }
</style>
