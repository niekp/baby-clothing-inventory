<script lang="ts">
  import { COLORS, COLOR_HEX } from '$lib/config';

  let { current, onpick }: { current: string; onpick: (color: string) => void } = $props();
</script>

<div class="swatches">
  {#each COLORS as c (c)}
    <button
      type="button"
      class="sw"
      class:selected={current === c}
      onclick={() => onpick(current === c ? '' : c)}
      aria-pressed={current === c}
      aria-label={c}
      title={c}
    >
      <span class="dot" class:multi={c === 'multicolor'} style:background={COLOR_HEX[c]}></span>
    </button>
  {/each}
</div>

<style>
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .sw {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .dot {
    display: block;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18); /* rand zodat wit/beige zichtbaar blijft */
  }
  .dot.multi {
    background: conic-gradient(#e23b3b, #f4d031, #3faa57, #3b82f6, #8b5cf6, #f48fb1, #e23b3b);
  }
  .sw.selected .dot {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--accent); /* accent-ring met gat ertussen */
  }
</style>
