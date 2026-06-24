<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    title = '',
    onclose,
    children
  }: { open?: boolean; title?: string; onclose?: () => void; children?: Snippet } = $props();

  let sheetEl = $state<HTMLElement>();
  let prevFocus: HTMLElement | null = null;

  function close() {
    open = false;
    onclose?.();
  }

  function focusables(): HTMLElement[] {
    if (!sheetEl) return [];
    return Array.from(
      sheetEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab') {
      // focus binnen de sheet houden
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        sheetEl?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const act = document.activeElement;
      if (e.shiftKey && act === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && act === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Focus de sheet bij openen; herstel de vorige focus bij sluiten.
  $effect(() => {
    if (open && sheetEl) {
      prevFocus = document.activeElement as HTMLElement | null;
      (focusables()[0] ?? sheetEl).focus();
      return () => prevFocus?.focus?.();
    }
  });
</script>

<svelte:window onkeydown={open ? onKey : undefined} />

{#if open}
  <button class="backdrop" aria-label="Sluiten" onclick={close}></button>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-label={title || 'Paneel'}
    tabindex="-1"
    bind:this={sheetEl}
  >
    {#if title}
      <header class="sheet-head">
        <h2>{title}</h2>
        <button class="x" onclick={close} aria-label="Sluiten"><Icon name="x" size={20} /></button>
      </header>
    {/if}
    <div class="sheet-body">
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 22, 30, 0.4);
    z-index: 40;
    border: none;
    padding: 0;
    cursor: default;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    background: var(--surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-2);
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    padding-bottom: env(safe-area-inset-bottom);
    animation: slide-up 0.18s ease-out;
  }
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      animation: none;
    }
  }
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .sheet-head h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .x {
    background: none;
    border: none;
    font-size: var(--fs-lg);
    color: var(--text-muted);
    padding: var(--space-1);
  }
  .sheet-body {
    padding: var(--space-4);
    overflow-y: auto;
  }

  @media (min-width: 768px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: min(520px, 92vw);
      border-radius: var(--radius-lg);
      animation: none;
    }
  }
</style>
