<script lang="ts">
  import { untrack } from 'svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  import ItemFields, { type ItemFormValue } from './ItemFields.svelte';
  import type { ItemDTO } from '$lib/server/serialize';

  let {
    item,
    onconfirm,
    onskip
  }: {
    item: ItemDTO;
    onconfirm: (form: ItemFormValue) => void;
    onskip: () => void;
  } = $props();

  // Voor-invullen: bestaande waarden, anders de AI-suggestie (als die er is), anders leeg.
  // Eén keer seeden; de kaart wordt per item geremount ({#key} in de review-pagina).
  let form = $state<ItemFormValue>(
    untrack(() => {
      const s = item.suggestions ?? {};
      return {
        size: item.size,
        type: item.type ?? s.type ?? '',
        length: item.length ?? s.length ?? '',
        seasons: item.seasons.length ? [...item.seasons] : s.season ? [s.season] : [],
        quality: item.quality ?? '',
        color: item.color ?? s.color ?? '',
        note: item.note ?? ''
      };
    })
  );

  let hasSuggestion = $derived.by(() => {
    const s = item.suggestions ?? {};
    return (!item.type && !!s.type) || (!item.color && !!s.color) || !!s.season || !!s.length;
  });

  // --- swipe via Pointer Events (alleen op de foto, zodat de velden vrij te bedienen zijn) ---
  const THRESHOLD = 120; // ruime dode zone: pas vanaf hier telt 't als swipe
  const ARM = 40; // vanaf hier kleurt de indicator op (feedback dat je goed zit)
  let dx = $state(0);
  let dy = 0;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let pointerId = -1;
  let flying = $state<'left' | 'right' | null>(null);

  function down(e: PointerEvent) {
    if (flying) return;
    dragging = true;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
  }
  function move(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
  }
  function up(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) confirm();
      else skip();
    } else {
      dx = 0;
    }
  }

  function confirm() {
    if (flying) return;
    flying = 'right';
    const snapshot = { ...form, seasons: [...form.seasons] };
    setTimeout(() => onconfirm(snapshot), 180);
  }
  function skip() {
    if (flying) return;
    flying = 'left';
    setTimeout(() => onskip(), 180);
  }
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={up} />

<div class="stage">
  <!-- alleen de foto swipet/vliegt; de rest (incl. de indicators) blijft staan -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="swipe"
    class:fly-left={flying === 'left'}
    class:fly-right={flying === 'right'}
    style:transform={flying ? undefined : `translateX(${dx}px) rotate(${dx / 40}deg)`}
    onpointerdown={down}
  >
    <div class="photo">
      {#if item.cutout_url || item.display_url}
        <img src={item.cutout_url ?? item.display_url} alt={item.type ?? 'kledingstuk'} draggable="false" />
      {:else}
        <div class="ph"><Icon name="shirt" size={64} /></div>
      {/if}
      <span class="size">{item.size}</span>
      {#if hasSuggestion}<span class="ai">AI-suggestie ingevuld</span>{/if}
    </div>
  </div>

  <!-- statische indicator-laag onder de foto: blijft zichtbaar tijdens 't slepen -->
  <div class="legend" aria-hidden="true">
    <span class="dir skip" class:active={dx < -ARM}><Icon name="arrow-left" size={16} /> Overslaan</span>
    <span class="dir save" class:active={dx > ARM}>Opslaan <Icon name="arrow-right" size={16} /></span>
  </div>
  <p class="hint">Sleep de foto opzij, of gebruik de knoppen onderaan.</p>
  <ItemFields bind:value={form} showNote={false} />

  <div class="actions">
    <Button variant="ghost" block disabled={!!flying} onclick={skip}>Overslaan</Button>
    <Button variant="primary" block disabled={!!flying} onclick={confirm}>Opslaan</Button>
  </div>
</div>

<style>
  .stage {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
    padding: var(--space-4);
    overflow: hidden; /* de wegvliegende foto netjes binnen de kaart clippen */
  }
  .swipe {
    touch-action: pan-y; /* horizontale swipe zelf afhandelen, verticaal scrollen vrij */
    cursor: grab;
    will-change: transform;
  }
  .swipe.fly-left {
    transition: transform 0.18s ease-in;
    transform: translateX(-130%) rotate(-12deg);
  }
  .swipe.fly-right {
    transition: transform 0.18s ease-in;
    transform: translateX(130%) rotate(12deg);
  }
  .photo {
    position: relative;
    aspect-ratio: 1;
    background: var(--surface-2);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    -webkit-user-drag: none;
  }
  .ph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 64px;
    opacity: 0.4;
  }
  .size {
    position: absolute;
    left: var(--space-2);
    top: var(--space-2);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-weight: 700;
    padding: 2px 10px;
    border-radius: 8px;
  }
  .ai {
    position: absolute;
    right: var(--space-2);
    top: var(--space-2);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .legend {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-3);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .dir {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    padding: 2px 8px;
    border-radius: 999px;
    transition:
      color 0.1s,
      background 0.1s;
  }
  .dir.skip.active {
    color: #fff;
    background: var(--danger);
  }
  .dir.save.active {
    color: var(--accent-ink);
    background: var(--accent);
  }
  .hint {
    color: var(--text-muted);
    font-size: var(--fs-sm);
    margin: var(--space-1) 0 var(--space-2);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  .actions :global(.btn) {
    flex: 1;
  }
</style>
