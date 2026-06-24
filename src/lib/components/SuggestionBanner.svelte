<script lang="ts">
  import Button from './Button.svelte';
  import type { AiSuggestions } from '$lib/types';

  let {
    suggestions,
    onaccept,
    ondismiss
  }: {
    suggestions: AiSuggestions;
    onaccept: () => void;
    ondismiss?: () => void;
  } = $props();

  let parts = $derived(
    (['type', 'color', 'length', 'season'] as const)
      .map((k) => suggestions[k])
      .filter(Boolean)
      .join(' · ')
  );
</script>

<div class="banner">
  <div class="txt">
    <strong>AI-suggestie</strong>
    <span class="vals">{parts || 'geen velden'}</span>
  </div>
  <div class="acts">
    {#if ondismiss}<Button variant="ghost" onclick={ondismiss}>Negeren</Button>{/if}
    <Button variant="primary" onclick={onaccept}>Overnemen</Button>
  </div>
</div>

<style>
  .banner {
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .txt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .vals {
    color: var(--text-muted);
    font-size: var(--fs-sm);
  }
  .acts {
    display: flex;
    gap: var(--space-2);
  }
</style>
