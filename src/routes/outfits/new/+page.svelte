<script lang="ts">
  import OutfitComposer from '$lib/components/OutfitComposer.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { stack } from '$lib/client/stack.svelte';
  import type { OutfitLayoutInput } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // bron = de stapel; items uit de Kast resolven we naar volledige DTO's
  let stackItems = $derived(data.items.filter((i) => stack.has(i.id)));

  async function create(name: string, items: OutfitLayoutInput[]): Promise<number | null> {
    const res = await fetch('/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items })
    });
    if (!res.ok) return null;
    return ((await res.json()) as { id: number }).id;
  }
</script>

{#if stackItems.length === 0}
  <div class="empty">
    <h1>Lege stapel</h1>
    <p>Bouw eerst een stapel in de Kast: tik op <Icon name="plus" size={14} /> bij de items die je wil combineren.</p>
    <Button variant="primary" href="/"><Icon name="arrow-left" size={18} /> Naar de Kast</Button>
  </div>
{:else}
  <OutfitComposer items={stackItems} onsave={create} />
{/if}

<style>
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: var(--space-6) var(--space-4);
  }
  .empty h1 {
    font-size: var(--fs-lg);
    margin-bottom: var(--space-2);
  }
  .empty :global(.btn) {
    margin-top: var(--space-4);
  }
</style>
