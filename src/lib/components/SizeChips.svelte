<script lang="ts">
  import Chip from './Chip.svelte';
  import { SIZE_CHIPS } from '$lib/config';

  let { current, onpick }: { current: string; onpick: (size: string) => void } = $props();
</script>

<div class="size-grid">
  {#each SIZE_CHIPS as size (size)}
    <Chip label={size} selected={size === current} onclick={() => onpick(size)} />
  {/each}
</div>

<style>
  .size-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
