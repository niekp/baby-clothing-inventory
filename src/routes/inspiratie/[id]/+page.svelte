<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import PhotoCutoutView from '$lib/components/PhotoCutoutView.svelte';
  import { cutoutState } from '$lib/client/images';
  import { patchInspiration } from '$lib/client/inspiration';
  import { setSyncPaused } from '$lib/client/liveSync';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let serverNote = $derived(data.inspiration.note ?? '');
  let note = $state('');
  $effect(() => {
    note = serverNote; // server-waarde wint na (her)laden
  });
  let saving = $state(false);
  let sharpening = $state(false);
  let favoriting = $state(false);
  let msg = $state<string | null>(null);
  let err = $state<string | null>(null);

  let favorite = $derived(data.inspiration.favorite === 1);
  let noteChanged = $derived(note.trim() !== serverNote);

  // pauzeer live-sync bij een niet-opgeslagen notitie (anders vaagt een inkomende sync 'm weg)
  $effect(() => {
    setSyncPaused(noteChanged);
    return () => setSyncPaused(false);
  });

  async function run(action: () => Promise<void>) {
    msg = null;
    err = null;
    try {
      await action();
      await invalidateAll();
    } catch (e) {
      err = (e as Error).message;
    }
  }

  async function saveNote() {
    saving = true;
    await run(() => patchInspiration(data.inspiration.id, { note: note.trim() }));
    saving = false;
  }

  async function toggleFavorite() {
    favoriting = true;
    await run(() => patchInspiration(data.inspiration.id, { favorite: !favorite }));
    favoriting = false;
  }

  async function sharpen() {
    sharpening = true;
    await run(async () => {
      const res = await fetch(`/api/outfits/${data.inspiration.id}/recutout`, { method: 'POST' });
      if (!res.ok) throw new Error('Verscherpen mislukt');
      msg = 'Scherpere cutout in de wachtrij…';
    });
    sharpening = false;
  }

  async function del() {
    if (!confirm('Dit inspiratie-plaatje verwijderen?')) return;
    msg = null;
    err = null;
    const res = await fetch(`/api/outfits/${data.inspiration.id}`, { method: 'DELETE' });
    if (res.ok) goto('/inspiratie');
    else err = 'Verwijderen mislukt';
  }
</script>

<header class="bar">
  <a href="/inspiratie" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <h1>Inspiratie</h1>
  <button
    class="fav"
    class:on={favorite}
    onclick={toggleFavorite}
    disabled={favoriting}
    aria-pressed={favorite}
    aria-label={favorite ? 'Uit favorieten halen' : 'Als favoriet markeren'}
  >
    <Icon name="heart" size={22} fill={favorite} />
  </button>
</header>

{#if err}<p class="err" role="alert">{err}</p>{/if}
{#if msg}<p class="msg" role="status">{msg}</p>{/if}

<PhotoCutoutView
  cutout={cutoutState(data.inspiration)}
  label={data.inspiration.note ?? 'inspiratie'}
  cutoutUrl={data.inspiration.thumb_url}
  originalUrl={data.inspiration.orig_download_url}
/>

<div class="note-field">
  <label class="field-label" for="note">Notitie</label>
  <textarea id="note" bind:value={note} rows="3" placeholder="Bijv. combi met de gele broek"
  ></textarea>
  <Button variant="primary" disabled={!noteChanged || saving} onclick={saveNote}>
    {saving ? '…' : 'Notitie opslaan'}
  </Button>
</div>

<div class="actions">
  {#if !data.inspiration.is_sharp && !data.inspiration.cutout_busy}
    <Button variant="ghost" onclick={sharpen} disabled={sharpening}>
      <Icon name="loader" size={16} spin={sharpening} /> Scherpere cutout
    </Button>
  {/if}
  {#if data.inspiration.orig_download_url}
    <Button variant="ghost" href={data.inspiration.orig_download_url}>
      <Icon name="download" size={16} /> Origineel
    </Button>
  {/if}
  <Button variant="danger" onclick={del}><Icon name="trash" size={16} /> Verwijderen</Button>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .bar h1 {
    margin: 0;
    font-size: var(--fs-xl);
    flex: 1;
  }
  .back {
    font-size: var(--fs-xl);
  }
  .fav {
    background: none;
    border: none;
    padding: var(--space-1);
    color: var(--text-muted);
    cursor: pointer;
  }
  .fav.on {
    color: #ff5a7a;
  }
  .msg {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .note-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: var(--space-4) 0;
  }
  .note-field textarea {
    width: 100%;
    font: inherit;
    padding: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    resize: vertical;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    justify-content: center;
  }
</style>
