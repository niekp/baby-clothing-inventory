<script lang="ts">
  import Chip from './Chip.svelte';
  import { SIZES } from '$lib/config';

  let { current, onpick }: { current: string; onpick: (size: string) => void } = $props();
</script>

<div class="size-grid">
  {#each SIZES as size (size)}
    <Chip label={String(size)} selected={String(size) === current} onclick={() => onpick(String(size))} />
  {/each}
</div>

<style>
  .size-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
