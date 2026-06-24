<script lang="ts">
  import Heatmap from '$lib/components/Heatmap.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // kind-markers: standaard alle kinderen met een maat aan
  let enabled = $state<Record<number, boolean>>({});
  $effect(() => {
    enabled = Object.fromEntries(
      data.children.filter((c) => c.current_sizes.length).map((c) => [c.id, true])
    );
  });

  let highlightSizes = $derived(
    new Set(
      data.children.filter((c) => c.current_sizes.length && enabled[c.id]).flatMap((c) => c.current_sizes)
    )
  );
</script>

<h1>Cijfers</h1>

{#if data.total === 0}
  <div class="empty">
    <p class="muted">Nog niets om te tellen.</p>
    <Button variant="primary" href="/scan"><Icon name="camera" size={18} /> Begin met scannen</Button>
  </div>
{:else}
  <p class="muted total">{data.total} item{data.total === 1 ? '' : 's'} totaal · tik een cel om te filteren</p>

  {#if data.children.some((c) => c.current_sizes.length)}
    <div class="markers">
      {#each data.children as c (c.id)}
        {#if c.current_sizes.length}
          <Chip
            label={`${c.name} · ${c.current_sizes.join(', ')}`}
            selected={enabled[c.id]}
            onclick={() => (enabled[c.id] = !enabled[c.id])}
          />
        {/if}
      {/each}
    </div>
  {/if}

  <Heatmap counts={data.counts} {highlightSizes} />
{/if}

<style>
  h1 {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-xl);
  }
  .total {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-sm);
  }
  .markers {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
</style>
