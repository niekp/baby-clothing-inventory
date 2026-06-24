<script lang="ts">
  import {
    angleDeg,
    BASE,
    clampScale,
    dist,
    H,
    transform,
    W,
    type Placed,
    type Pt
  } from '$lib/client/outfit-canvas-space';

  let {
    placed = $bindable(),
    selectedKey = $bindable(),
    readonly = false
  }: { placed: Placed[]; selectedKey?: number | null; readonly?: boolean } = $props();

  let canvasEl: HTMLDivElement;

  // pointers die momenteel op items staan (id → client x/y)
  const pointers = new Map<number, Pt>();
  type Gesture = {
    mode: 'drag' | 'transform' | 'pinch';
    key: number;
    base: { x: number; y: number; scale: number; rotation: number };
    rect: DOMRect;
    pointerId: number; // drag/transform: de aansturende pointer
    startClient?: Pt;
    centerClient?: Pt;
    pinchIds?: [number, number]; // pinch: de twee betrokken pointers (id-gebaseerd)
    initialDist?: number;
    initialAngle?: number;
    initialCentroid?: Pt;
  };
  let gesture: Gesture | null = null;

  function get(key: number): Placed | undefined {
    return placed.find((p) => p.key === key);
  }
  function update(key: number, patch: Partial<Placed>) {
    placed = placed.map((p) => (p.key === key ? { ...p, ...patch } : p));
  }
  function centerClient(p: Placed, rect: DOMRect): Pt {
    return { x: rect.left + (p.x / W) * rect.width, y: rect.top + (p.y / H) * rect.height };
  }
  const centroid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function onItemDown(e: PointerEvent, key: number) {
    e.stopPropagation();
    selectedKey = key;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = get(key);
    if (!p) return;
    const rect = canvasEl.getBoundingClientRect();

    // tweede vinger op het reeds-actieve item → pinch
    if (pointers.size >= 2 && gesture && gesture.key === key) {
      const a = pointers.get(gesture.pointerId);
      const b = pointers.get(e.pointerId);
      if (a && b) {
        gesture = {
          mode: 'pinch',
          key,
          rect,
          pointerId: gesture.pointerId,
          pinchIds: [gesture.pointerId, e.pointerId],
          base: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation },
          initialDist: dist(a, b),
          initialAngle: angleDeg(a, b),
          initialCentroid: centroid(a, b)
        };
        return;
      }
    }
    gesture = {
      mode: 'drag',
      key,
      rect,
      pointerId: e.pointerId,
      base: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation },
      startClient: { x: e.clientX, y: e.clientY }
    };
  }

  function onHandleDown(e: PointerEvent, key: number) {
    e.stopPropagation();
    selectedKey = key;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = get(key);
    if (!p) return;
    const rect = canvasEl.getBoundingClientRect();
    const c = centerClient(p, rect);
    const cur = { x: e.clientX, y: e.clientY };
    gesture = {
      mode: 'transform',
      key,
      rect,
      pointerId: e.pointerId,
      base: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation },
      centerClient: c,
      initialDist: dist(c, cur),
      initialAngle: angleDeg(c, cur)
    };
  }

  function onMove(e: PointerEvent) {
    const g = gesture;
    if (!g) return;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const sx = W / g.rect.width;
    const sy = H / g.rect.height;

    if (g.mode === 'drag' && g.startClient) {
      if (e.pointerId !== g.pointerId) return; // alleen de aansturende pointer
      update(g.key, {
        x: g.base.x + (e.clientX - g.startClient.x) * sx,
        y: g.base.y + (e.clientY - g.startClient.y) * sy
      });
    } else if (g.mode === 'transform' && g.centerClient && g.initialDist != null) {
      if (e.pointerId !== g.pointerId) return;
      const cur = { x: e.clientX, y: e.clientY };
      update(g.key, transform(g.base.scale, g.base.rotation, g.initialDist, g.initialAngle ?? 0, dist(g.centerClient, cur), angleDeg(g.centerClient, cur)));
    } else if (g.mode === 'pinch' && g.pinchIds && g.initialDist != null && g.initialCentroid) {
      const a = pointers.get(g.pinchIds[0]);
      const b = pointers.get(g.pinchIds[1]);
      if (!a || !b) return;
      const t = transform(g.base.scale, g.base.rotation, g.initialDist, g.initialAngle ?? 0, dist(a, b), angleDeg(a, b));
      const c = centroid(a, b);
      update(g.key, {
        ...t,
        x: g.base.x + (c.x - g.initialCentroid.x) * sx,
        y: g.base.y + (c.y - g.initialCentroid.y) * sy
      });
    }
  }

  function onUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    // pinch blijft alleen leven zolang béide pinch-pointers nog neer zijn
    if (gesture.mode === 'pinch' && gesture.pinchIds) {
      if (pointers.has(gesture.pinchIds[0]) && pointers.has(gesture.pinchIds[1])) return;
    }
    gesture = null; // re-press om een nieuw gebaar te starten (geen sprong)
  }

  function onBackgroundDown() {
    selectedKey = null;
  }
</script>

<svelte:window
  onpointermove={readonly ? undefined : onMove}
  onpointerup={readonly ? undefined : onUp}
  onpointercancel={readonly ? undefined : onUp}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="canvas"
  class:readonly
  bind:this={canvasEl}
  onpointerdown={readonly ? undefined : onBackgroundDown}
>
  {#each [...placed].sort((a, b) => a.z - b.z) as p (p.key)}
    <div
      class="placed"
      class:selected={!readonly && p.key === selectedKey}
      style:left={`${(p.x / W) * 100}%`}
      style:top={`${(p.y / H) * 100}%`}
      style:width={`${((BASE * p.scale) / W) * 100}%`}
      style:transform={`translate(-50%, -50%) rotate(${p.rotation}deg)`}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <img
        src={p.url}
        alt=""
        draggable="false"
        onpointerdown={readonly ? undefined : (e) => onItemDown(e, p.key)}
      />
      {#if !readonly && p.key === selectedKey}
        <button
          class="handle"
          aria-label="Schalen en draaien"
          onpointerdown={(e) => onHandleDown(e, p.key)}
        ></button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .canvas {
    position: relative;
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    aspect-ratio: 1000 / 1333;
    background:
      repeating-conic-gradient(var(--surface-2) 0% 25%, var(--surface) 0% 50%) 0 / 28px 28px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    touch-action: none; /* alle pointer-gestures zelf afhandelen */
    user-select: none;
  }
  .canvas.readonly {
    touch-action: auto;
  }
  .placed {
    position: absolute;
  }
  .placed img {
    width: 100%;
    height: auto;
    display: block;
    -webkit-user-drag: none;
    pointer-events: auto;
  }
  .placed.selected {
    outline: 2px dashed var(--accent);
    outline-offset: 2px;
  }
  .handle {
    position: absolute;
    right: -12px;
    bottom: -12px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid #fff;
    box-shadow: var(--shadow-1);
    padding: 0;
    touch-action: none;
  }
</style>
