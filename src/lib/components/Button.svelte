<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    variant = 'primary',
    href,
    type = 'button',
    disabled = false,
    block = false,
    onclick,
    children,
    ...rest
  }: {
    variant?: 'primary' | 'danger' | 'ghost';
    href?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean; // volle breedte
    onclick?: () => void;
    children: Snippet;
    [key: string]: unknown; // aria-*/data-* passthrough
  } = $props();
</script>

{#if href}
  <!-- <a> kan niet echt 'disabled'; emuleer met aria-disabled + pointer-events:none -->
  <a
    class="btn {variant}"
    class:block
    class:disabled
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    {...rest}
  >
    {@render children()}
  </a>
{:else}
  <button class="btn {variant}" class:block {type} {disabled} {onclick} {...rest}>
    {@render children()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    border: 1px solid var(--border);
    font-size: var(--fs-base);
    font-weight: 600;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .btn.block {
    width: 100%;
  }
  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .btn.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }
  .btn.ghost {
    background: var(--surface);
    color: var(--text);
  }
  .btn:disabled,
  .btn.disabled {
    opacity: 0.5;
    cursor: default;
    pointer-events: none;
  }
</style>
