<script lang="ts">
  import OutfitComposer from '$lib/components/OutfitComposer.svelte';
  import type { OutfitLayoutInput } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

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

<OutfitComposer items={data.items} onsave={create} />
