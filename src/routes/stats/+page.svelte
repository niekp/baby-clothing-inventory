<script lang="ts">
  import Heatmap from '$lib/components/Heatmap.svelte';
  import SeasonMatrix from '$lib/components/SeasonMatrix.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { SIZE_STRINGS, expandSize } from '$lib/config';
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

  // default-maat voor de seizoen-matrix: eerste kind-maat, anders de meest-gevulde
  // (telling op kleinste component, zoals de matrix zelf)
  function defaultSize(): string {
    const child = data.children.find((c) => c.current_sizes.length)?.current_sizes[0];
    if (child && SIZE_STRINGS.includes(child)) return child;
    const per = new Map<string, number>();
    for (const c of data.counts) {
      const s = expandSize(String(c.size))[0];
      per.set(s, (per.get(s) ?? 0) + c.n);
    }
    let best = SIZE_STRINGS[0];
    let max = -1;
    for (const [s, n] of per) {
      if (n > max) {
        max = n;
        best = s;
      }
    }
    return best;
  }

  let selectedSize = $state('');
  $effect(() => {
    if (!selectedSize) selectedSize = defaultSize();
  });
</script>

<header class="bar">
  <a href="/settings" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <h1>Cijfers</h1>
</header>

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

  <h2>Maat × type</h2>
  <Heatmap counts={data.counts} {highlightSizes} />

  <h2>Per seizoen</h2>
  <p class="muted hint">Kies een maat — soort × seizoen (allseason telt in elk seizoen)</p>
  <div class="markers">
    {#each SIZE_STRINGS as s (s)}
      <Chip label={s} selected={selectedSize === s} onclick={() => (selectedSize = s)} />
    {/each}
  </div>
  {#if selectedSize}
    <SeasonMatrix rows={data.seasonRows} size={selectedSize} />
  {/if}
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .back {
    font-size: var(--fs-xl);
  }
  h1 {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-xl);
  }
  h2 {
    margin: var(--space-5) 0 var(--space-2);
    font-size: var(--fs-lg);
  }
  .hint {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-sm);
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
