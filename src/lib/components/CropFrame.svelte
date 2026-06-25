<script lang="ts">
  import type { CropRect } from '$lib/client/capture';

  // Hoogteband: volle breedte, alleen boven- en onderrand verstelbaar.
  let {
    rect = $bindable(),
    onchange
  }: { rect: CropRect; onchange?: (r: CropRect) => void } = $props();

  let el = $state<HTMLDivElement>();
  const MIN = 0.12; // minimale bandhoogte

  let drag: { edge: 'top' | 'bottom'; py: number; top: number; bottom: number } | null = null;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  function begin(e: PointerEvent, edge: 'top' | 'bottom') {
    e.preventDefault();
    e.stopPropagation();
    drag = { edge, py: e.clientY, top: rect.y, bottom: rect.y + rect.h };
  }

  function onMove(e: PointerEvent) {
    if (!drag || !el) return;
    const dy = (e.clientY - drag.py) / el.clientHeight;
    let top = drag.top;
    let bottom = drag.bottom;
    if (drag.edge === 'top') top = Math.min(clamp(drag.top + dy), bottom - MIN);
    else bottom = Math.max(clamp(drag.bottom + dy), top + MIN);
    rect = { x: 0, y: top, w: 1, h: bottom - top };
  }

  function end() {
    if (!drag) return;
    drag = null;
    onchange?.(rect);
  }
</script>

<svelte:window onpointermove={onMove} onpointerup={end} />

<div class="crop" bind:this={el}>
  <!-- gedimd buiten de band -->
  <div class="dim" style="top:0;height:{rect.y * 100}%"></div>
  <div class="dim" style="top:{(rect.y + rect.h) * 100}%;bottom:0"></div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bar" style="top:{rect.y * 100}%" onpointerdown={(e) => begin(e, 'top')}>
    <span class="grip"></span>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="bar" style="top:{(rect.y + rect.h) * 100}%" onpointerdown={(e) => begin(e, 'bottom')}>
    <span class="grip"></span>
  </div>
</div>

<style>
  .crop {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
  .dim {
    position: absolute;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.4);
  }
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 48px; /* ruime raakzone over de volle breedte */
    transform: translateY(-24px); /* gecentreerd op de lijn */
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    touch-action: none;
    cursor: ns-resize;
  }
  /* de lijn zelf */
  .bar::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    background: rgba(255, 255, 255, 0.95);
  }
  /* grip-pil in het midden */
  .grip {
    position: relative;
    width: 52px;
    height: 18px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    border: 2px solid #fff;
  }
</style>
