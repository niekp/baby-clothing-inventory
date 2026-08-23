<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PhotoCard from '$lib/components/PhotoCard.svelte';
  import { cutoutState, photoCardSources } from '$lib/client/images';
  import { uploadInspiration } from '$lib/client/inspiration';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let fileInput = $state<HTMLInputElement | null>(null);
  let uploading = $state(false);
  let done = $state(0);
  let total = $state(0);
  let failures = $state<string[]>([]);

  // sequentieel: voortgang en mislukte bestanden blijven per stuk zichtbaar
  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = ''; // zodat dezelfde selectie opnieuw gekozen kan worden
    if (!files.length) return;

    uploading = true;
    done = 0;
    total = files.length;
    failures = [];
    for (const file of files) {
      try {
        await uploadInspiration(file);
      } catch (err) {
        failures = [...failures, `${file.name}: ${(err as Error).message}`];
      }
      done += 1;
    }
    uploading = false;
    await invalidateAll();
  }
</script>

<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  multiple
  hidden
  bind:this={fileInput}
  onchange={upload}
/>

<header class="head">
  <h1>Inspiratie</h1>
  <Button variant="primary" disabled={uploading} onclick={() => fileInput?.click()}>
    <Icon name="plus" size={18} /> Toevoegen
  </Button>
</header>

{#if uploading}
  <p class="progress" role="status">
    <Icon name="loader" size={16} spin /> {done} van {total} geüpload…
  </p>
{/if}

{#if failures.length}
  <div class="failures" role="alert">
    <p>{failures.length} van {total} mislukt:</p>
    <ul>
      {#each failures as failure, i (i)}
        <li>{failure}</li>
      {/each}
    </ul>
  </div>
{/if}

{#if data.inspiration.length === 0}
  <div class="empty">
    <span class="icon" aria-hidden="true"><Icon name="sparkles" size={48} /></span>
    <p class="muted">Nog geen inspiratie. Zet hier printscreens van looks die je mooi vindt.</p>
    <Button variant="primary" disabled={uploading} onclick={() => fileInput?.click()}>
      <Icon name="plus" size={18} /> Printscreens toevoegen
    </Button>
  </div>
{:else}
  <div class="grid">
    {#each data.inspiration as o (o.id)}
      <PhotoCard
        href={`/inspiratie/${o.id}`}
        label={o.note ?? ''}
        sources={photoCardSources(o)}
        cutout={cutoutState(o)}
        favorite={o.favorite === 1}
        altFallback="inspiratie"
        placeholderIcon="sparkles"
      />
    {/each}
  </div>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }
  .head h1 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  @media (min-width: 600px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    }
  }
  .empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  .empty .icon {
    opacity: 0.35;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-3);
  }
  .failures {
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
    border-radius: var(--radius);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    font-size: var(--fs-sm);
  }
  .failures p {
    margin: 0 0 var(--space-1);
    font-weight: 600;
  }
  .failures ul {
    margin: 0;
    padding-left: var(--space-4);
  }
</style>
