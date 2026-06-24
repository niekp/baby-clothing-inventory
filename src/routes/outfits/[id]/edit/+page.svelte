<script lang="ts">
  import OutfitComposer from '$lib/components/OutfitComposer.svelte';
  import { outfitItemsToPlaced } from '$lib/client/outfit-placed';
  import type { OutfitLayoutInput } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Afgeleid van de geladen outfit. De {#key} hieronder remount de composer als
  // het outfit-id wijzigt (SvelteKit hergebruikt anders dezelfde component bij
  // edit→edit-navigatie), zodat 'initialPlaced' nooit stale is.
  let initialPlaced = $derived(outfitItemsToPlaced(data.outfit.items));

  async function update(name: string, items: OutfitLayoutInput[]): Promise<number | null> {
    const res = await fetch(`/api/outfits/${data.outfit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items })
    });
    if (!res.ok) return null;
    return data.outfit.id;
  }
</script>

{#key data.outfit.id}
  <OutfitComposer
    items={data.items}
    initialName={data.outfit.name}
    {initialPlaced}
    onsave={update}
  />
{/key}
