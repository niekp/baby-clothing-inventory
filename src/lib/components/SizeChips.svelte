<script lang="ts">
  import Chip from './Chip.svelte';
  import { SIZE_STRINGS, expandSize, toggleSizePick } from '$lib/config';

  let { current, onpick }: { current: string; onpick: (size: string) => void } = $props();

  // actieve enkele maten: 1 bij enkel, 2 bij dubbel (62/68 → 62 én 68)
  let active = $derived(new Set(current ? expandSize(current) : []));
</script>

<div class="size-grid">
  {#each SIZE_STRINGS as size (size)}
    <Chip label={size} selected={active.has(size)} onclick={() => onpick(toggleSizePick(current, size))} />
  {/each}
</div>
<p class="hint">Tik twee aangrenzende maten voor een dubbele maat (bv. 62/68).</p>

<style>
  .size-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .hint {
    margin: var(--space-2) 0 0;
    font-size: var(--fs-sm);
    color: var(--text-muted);
  }
</style>
