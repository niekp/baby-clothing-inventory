<script lang="ts">
  import Icon from './Icon.svelte';
  import type { CutoutView } from '$lib/client/images';

  let {
    cutout,
    label,
    cutoutUrl,
    originalUrl
  }: {
    cutout: CutoutView;
    label: string;
    cutoutUrl: string | null;
    originalUrl: string | null;
  } = $props();
</script>

{#if cutout === 'ready' && cutoutUrl}
  <div class="photo"><img src={cutoutUrl} alt={label} /></div>
{:else}
  <div class="photo state">
    {#if originalUrl}<img src={originalUrl} alt={label} />{/if}
    {#if cutout === 'failed'}
      <p class="badge fail"><Icon name="alert" size={14} /> Cutout mislukt — originele foto getoond</p>
    {:else}
      <p class="badge work"><Icon name="loader" size={14} spin /> Cutout wordt gemaakt…</p>
    {/if}
  </div>
{/if}

<style>
  .photo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .photo img {
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: var(--radius);
  }
  .photo.state img {
    opacity: 0.6;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-sm);
    border-radius: 999px;
    padding: var(--space-2) var(--space-3);
  }
  .badge.work {
    background: var(--surface-2);
    color: var(--text-muted);
  }
  .badge.fail {
    background: color-mix(in srgb, var(--danger) 15%, transparent);
    color: var(--danger);
  }
</style>
