<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ItemFields, { type ItemFormValue, blankForm } from '$lib/components/ItemFields.svelte';
  import SuggestionBanner from '$lib/components/SuggestionBanner.svelte';
  import { suggestionPatch } from '$lib/suggestions';
  import { fileToNormalizedJpeg } from '$lib/client/capture';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let form = $state<ItemFormValue>(blankForm());

  // (her)initialiseer het formulier wanneer het item verandert (na save/accept → invalidate)
  $effect(() => {
    const it = data.item;
    form = {
      size: it.size,
      type: it.type ?? '',
      length: it.length ?? '',
      seasons: [...it.seasons],
      quality: it.quality ?? '',
      color: it.color ?? '',
      note: it.note ?? ''
    };
  });

  let zoom = $state(false);
  let saving = $state(false);
  let recutting = $state(false);
  let newPhotoBusy = $state(false);
  let msg = $state<string | null>(null);

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

  let dirty = $derived(
    form.size !== data.item.size ||
      form.type !== (data.item.type ?? '') ||
      form.length !== (data.item.length ?? '') ||
      !sameSet(form.seasons, data.item.seasons) ||
      form.quality !== (data.item.quality ?? '') ||
      form.color !== (data.item.color ?? '') ||
      form.note !== (data.item.note ?? '')
  );

  async function patch(body: Record<string, unknown>) {
    msg = null;
    const res = await fetch(`/api/items/${data.item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) await invalidateAll();
    else msg = 'Opslaan mislukt';
    return res.ok;
  }

  async function save() {
    saving = true;
    await patch({
      size: form.size,
      type: form.type || null,
      length: form.length || null,
      seasons: form.seasons,
      quality: form.quality || null,
      color: form.color || null,
      note: form.note || null
    });
    saving = false;
  }

  function toggleFav() {
    patch({ favorite: !data.item.favorite });
  }

  async function acceptSuggestions() {
    const p = suggestionPatch(data.item, data.item.suggestions);
    await patch({ ...p, ai_status: 'done' });
  }
  function dismissSuggestions() {
    patch({ ai_status: 'done' });
  }

  // Vervang de foto van dit item (labels blijven). Normaliseert client-side en post naar /photo.
  async function onNewPhoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    newPhotoBusy = true;
    msg = null;
    try {
      const blob = await fileToNormalizedJpeg(file);
      const fd = new FormData();
      fd.append('photo', blob, 'photo.jpg');
      const res = await fetch(`/api/items/${data.item.id}/photo`, { method: 'POST', body: fd });
      if (res.ok) await invalidateAll();
      else msg = 'Nieuwe foto mislukt';
    } catch {
      msg = 'Nieuwe foto mislukt';
    } finally {
      newPhotoBusy = false;
    }
  }

  // Scherpere cutout via birefnet (zwaar, ~2-3 min); alleen op verzoek voor lastige foto's.
  async function sharperCutout() {
    if (recutting) return;
    recutting = true;
    msg = null;
    try {
      const res = await fetch(`/api/items/${data.item.id}/recutout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'birefnet-general' })
      });
      if (res.ok) await invalidateAll();
      else msg = 'Scherpere cutout mislukt';
    } catch {
      msg = 'Scherpere cutout mislukt (duurde te lang?)';
    } finally {
      recutting = false;
    }
  }

  async function del() {
    if (!confirm('Dit item verwijderen?')) return;
    const res = await fetch(`/api/items/${data.item.id}`, { method: 'DELETE' });
    if (res.ok) goto('/');
    else msg = 'Verwijderen mislukt';
  }
</script>

<div class="detail">
  <header class="bar">
    <a href="/" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
    <button class="fav" class:on={data.item.favorite} onclick={toggleFav} aria-label="Favoriet">
      <Icon name="heart" size={24} fill={!!data.item.favorite} />
    </button>
  </header>

  <button class="photo" onclick={() => (zoom = true)} aria-label="Foto vergroten">
    {#if data.item.cutout_url || data.item.display_url}
      <!-- cutout heeft voorkeur (schoon, vrijstaand); zoom toont de echte foto -->
      <img src={data.item.cutout_url ?? data.item.display_url} alt={data.item.type ?? 'kledingstuk'} />
    {:else}
      <div class="ph"><Icon name="shirt" size={64} /></div>
    {/if}
  </button>

  <label class="newphoto" class:busy={newPhotoBusy}>
    {#if newPhotoBusy}
      <Icon name="loader" size={16} spin /> Nieuwe foto verwerken…
    {:else}
      <Icon name="camera" size={16} /> Nieuwe foto
    {/if}
    <input type="file" accept="image/*" capture="environment" onchange={onNewPhoto} disabled={newPhotoBusy} hidden />
  </label>

  {#if data.item.ai_status === 'suggested' && data.item.suggestions}
    <SuggestionBanner
      suggestions={data.item.suggestions}
      onaccept={acceptSuggestions}
      ondismiss={dismissSuggestions}
    />
  {/if}

  <ItemFields bind:value={form} />

  {#if msg}<p class="err" role="alert">{msg}</p>{/if}

  <div class="save-bar">
    <Button variant="primary" block disabled={!dirty || saving} onclick={save}>
      {saving ? 'Opslaan…' : 'Opslaan'}
    </Button>
  </div>

  <div class="extra">
    <button class="recut" onclick={sharperCutout} disabled={recutting}>
      {#if recutting}
        <Icon name="loader" size={16} spin /> Scherpere cutout… (kan een paar minuten duren)
      {:else}
        <Icon name="shapes" size={16} /> Scherpere cutout
      {/if}
    </button>
    <button class="del" onclick={del}>
      <Icon name="trash" size={16} /> Verwijderen
    </button>
  </div>
</div>

{#if zoom}
  <!-- div i.p.v. button: een <a download> mag niet in een <button> nesten -->
  <div
    class="zoom"
    role="button"
    tabindex="0"
    aria-label="Sluiten"
    onclick={() => (zoom = false)}
    onkeydown={(e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') zoom = false;
    }}
  >
    {#if data.item.display_url}<img src={data.item.display_url} alt="" />{/if}
    {#if data.item.orig_download_url}
      <a class="zoom-dl" href={data.item.orig_download_url} download onclick={(e) => e.stopPropagation()}>
        <Icon name="download" size={16} /> Origineel
      </a>
    {/if}
  </div>
{/if}

<style>
  .detail {
    max-width: 560px;
    margin: 0 auto;
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .back {
    font-size: var(--fs-xl);
    padding: var(--space-1) var(--space-2);
  }
  .fav {
    background: none;
    border: none;
    font-size: var(--fs-xl);
    color: #ff5a7a;
  }
  .fav:not(.on) {
    color: var(--text-muted);
  }
  .photo {
    display: block;
    width: 100%;
    border: none;
    padding: 0;
    background: var(--surface-2);
    border-radius: var(--radius);
    overflow: hidden;
    aspect-ratio: 1;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .newphoto {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: var(--fs-sm);
    cursor: pointer;
  }
  .newphoto.busy {
    color: var(--text-muted);
    cursor: default;
  }
  .ph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 64px;
    opacity: 0.4;
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: var(--space-3) 0 0;
  }
  .save-bar {
    margin-top: var(--space-3);
    position: sticky;
    bottom: var(--space-3);
  }
  .extra {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .recut {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: var(--fs-sm);
    padding: var(--space-2) var(--space-3);
  }
  .recut:disabled {
    color: var(--text-muted);
  }
  .del {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: var(--fs-sm);
    padding: var(--space-2);
  }
  .del:hover {
    color: var(--danger);
  }
  .zoom {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(0, 0, 0, 0.92);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-4);
  }
  .zoom img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .zoom-dl {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom) + var(--space-4));
    left: 50%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: rgba(255, 255, 255, 0.18);
    color: #fff;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
  }
</style>
