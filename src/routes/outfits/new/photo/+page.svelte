<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SizeChips from '$lib/components/SizeChips.svelte';
  import { createPhotoOutfit } from '$lib/client/outfit-photo';

  let name = $state('');
  let size = $state('');
  let file = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let saving = $state(false);
  let msg = $state<string | null>(null);

  function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    file = f;
    previewUrl = f ? URL.createObjectURL(f) : null;
  }

  onDestroy(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  async function save() {
    if (!name.trim() || !file) return;
    saving = true;
    msg = null;
    try {
      const id = await createPhotoOutfit(name.trim(), size, file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      goto(`/outfits/${id}`);
    } catch {
      msg = 'Opslaan mislukt';
      saving = false;
    }
  }
</script>

<header class="bar">
  <a href="/outfits" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <input class="input name" placeholder="Naam outfit" bind:value={name} aria-label="Naam" />
  <Button variant="primary" disabled={!name.trim() || !file || saving} onclick={save}>
    {saving ? '…' : 'Opslaan'}
  </Button>
</header>

{#if msg}<p class="err" role="alert">{msg}</p>{/if}

<label class="picker">
  {#if previewUrl}
    <img class="preview" src={previewUrl} alt="Gekozen foto" />
  {:else}
    <span class="ph"><Icon name="camera" size={40} /> Foto kiezen (camera of galerij)</span>
  {/if}
  <input type="file" accept="image/*" onchange={pickFile} hidden />
</label>

<div class="size-field">
  <p class="field-label">Maat (optioneel)</p>
  <SizeChips current={size} onpick={(s) => (size = s)} />
</div>

<style>
  .bar {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .back {
    font-size: var(--fs-xl);
  }
  .name {
    flex: 1;
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .picker {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    background: var(--surface-2);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
  }
  .ph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-muted);
    text-align: center;
    padding: var(--space-4);
  }
  .preview {
    width: 100%;
    max-height: 60vh;
    object-fit: contain;
  }
  .size-field {
    margin: var(--space-3) 0;
  }
</style>
