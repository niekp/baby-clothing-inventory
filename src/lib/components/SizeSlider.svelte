<script lang="ts">
  import { SIZE_CHIPS } from '$lib/config';

  let { current, onpick }: { current: string; onpick: (size: string) => void } = $props();

  // drag-override (visuele feedback tijdens slepen); null → toon de gecommitte maat
  let dragIdx = $state<number | null>(null);
  let committedIdx = $derived(Math.max(0, SIZE_CHIPS.indexOf(current)));
  let liveIdx = $derived(dragIdx ?? committedIdx);
</script>

<div class="slider">
  <div class="value">{SIZE_CHIPS[liveIdx]}</div>
  <input
    type="range"
    min="0"
    max={SIZE_CHIPS.length - 1}
    step="1"
    value={liveIdx}
    aria-label="Maat"
    aria-valuetext={SIZE_CHIPS[liveIdx]}
    oninput={(e) => (dragIdx = Number(e.currentTarget.value))}
    onchange={(e) => {
      dragIdx = null;
      onpick(SIZE_CHIPS[Number(e.currentTarget.value)]);
    }}
  />
  <div class="ends" aria-hidden="true">
    <span>{SIZE_CHIPS[0]}</span>
    <span>{SIZE_CHIPS[SIZE_CHIPS.length - 1]}</span>
  </div>
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
  }
  .value {
    font-size: var(--fs-xl);
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    width: 100%;
    height: 36px; /* ruime raakzone */
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    background: var(--border);
  }
  input[type='range']::-moz-range-track {
    height: 6px;
    border-radius: 999px;
    background: var(--border);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 28px;
    height: 28px;
    margin-top: -11px; /* centreren op de 6px track */
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  input[type='range']::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  input[type='range']:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .ends {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-sm);
    opacity: 0.7;
  }
</style>
