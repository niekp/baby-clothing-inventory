<script lang="ts">
  import type { CropRect } from '$lib/client/capture';

  let { rect = $bindable(), onchange }: { rect: CropRect; onchange?: (r: CropRect) => void } = $props();

  let el = $state<HTMLDivElement>();
  const MIN = 0.12; // minimale kadergrootte

  type Mode = { kind: 'move' } | { kind: 'resize'; cx: 0 | 1; cy: 0 | 1 };
  let drag: { mode: Mode; px: number; py: number; start: CropRect } | null = null; // geen $state nodig: handlers staan altijd aan, guarden op null

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  function begin(e: PointerEvent, mode: Mode) {
    e.preventDefault();
    e.stopPropagation();
    drag = { mode, px: e.clientX, py: e.clientY, start: { ...rect } };
  }

  function onMove(e: PointerEvent) {
    if (!drag || !el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const dx = (e.clientX - drag.px) / W;
    const dy = (e.clientY - drag.py) / H;
    const s = drag.start;
    if (drag.mode.kind === 'move') {
      const x = Math.max(0, Math.min(s.x + dx, 1 - s.w));
      const y = Math.max(0, Math.min(s.y + dy, 1 - s.h));
      rect = { x, y, w: s.w, h: s.h };
    } else {
      const { cx, cy } = drag.mode;
      let left = s.x;
      let right = s.x + s.w;
      let top = s.y;
      let bottom = s.y + s.h;
      if (cx === 0) left = Math.min(clamp(s.x + dx), right - MIN);
      else right = Math.max(clamp(right + dx), left + MIN);
      if (cy === 0) top = Math.min(clamp(s.y + dy), bottom - MIN);
      else bottom = Math.max(clamp(bottom + dy), top + MIN);
      rect = { x: left, y: top, w: right - left, h: bottom - top };
    }
  }

  function end() {
    if (!drag) return;
    drag = null;
    onchange?.(rect);
  }
</script>

<svelte:window onpointermove={onMove} onpointerup={end} />

<div class="crop" bind:this={el}>
  <div
    class="box"
    style="left:{rect.x * 100}%;top:{rect.y * 100}%;width:{rect.w * 100}%;height:{rect.h * 100}%"
    onpointerdown={(e) => begin(e, { kind: 'move' })}
    role="application"
    aria-label="Crop-kader verslepen"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="h tl" onpointerdown={(e) => begin(e, { kind: 'resize', cx: 0, cy: 0 })}></span>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="h tr" onpointerdown={(e) => begin(e, { kind: 'resize', cx: 1, cy: 0 })}></span>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="h bl" onpointerdown={(e) => begin(e, { kind: 'resize', cx: 0, cy: 1 })}></span>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="h br" onpointerdown={(e) => begin(e, { kind: 'resize', cx: 1, cy: 1 })}></span>
  </div>
</div>

<style>
  .crop {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none; /* alleen het kader vangt taps */
  }
  .box {
    position: absolute;
    pointer-events: auto;
    touch-action: none; /* geen scroll/zoom tijdens slepen */
    border: 2px solid rgba(255, 255, 255, 0.95);
    border-radius: 4px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4); /* dim buiten het kader */
    cursor: move;
  }
  .h {
    position: absolute;
    width: 28px;
    height: 28px;
    pointer-events: auto;
    touch-action: none;
    border: 3px solid #fff;
    background: rgba(0, 0, 0, 0.25);
  }
  .h.tl {
    left: -14px;
    top: -14px;
    border-right: none;
    border-bottom: none;
  }
  .h.tr {
    right: -14px;
    top: -14px;
    border-left: none;
    border-bottom: none;
  }
  .h.bl {
    left: -14px;
    bottom: -14px;
    border-right: none;
    border-top: none;
  }
  .h.br {
    right: -14px;
    bottom: -14px;
    border-left: none;
    border-top: none;
  }
</style>
