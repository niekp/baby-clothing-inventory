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
  import SizeChips from './SizeChips.svelte';
  import { TYPES, LENGTHS, SEASONS, QUALITIES } from '$lib/config';

  let {
    value = $bindable(),
    showNote = true
  }: { value: ItemFormValue; showNote?: boolean } = $props();

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

<p class="field-label">Maat</p>
<SizeChips current={value.size} onpick={(s) => (value.size = s)} />

<p class="field-label">Type</p>
<div class="chips">
  {#each TYPES as t (t)}
    <Chip label={t} selected={value.type === t} onclick={() => pick('type', t)} />
  {/each}
</div>

<p class="field-label">Lengte</p>
<div class="chips">
  {#each LENGTHS as l (l)}
    <Chip label={l} selected={value.length === l} onclick={() => pick('length', l)} />
  {/each}
</div>

<p class="field-label">Seizoen</p>
<div class="chips">
  {#each SEASONS as s (s)}
    <Chip label={s} selected={value.seasons.includes(s)} onclick={() => toggleSeason(s)} />
  {/each}
</div>

<p class="field-label">Kwaliteit</p>
<div class="chips">
  {#each QUALITIES as q (q)}
    <Chip label={q} selected={value.quality === q} onclick={() => pick('quality', q)} />
  {/each}
</div>

<p class="field-label">Kleur</p>
<input class="input" bind:value={value.color} placeholder="bv. blauw" />

{#if showNote}
  <p class="field-label">Notitie</p>
  <textarea class="input note" bind:value={value.note} rows="2"></textarea>
{/if}

<style>
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
