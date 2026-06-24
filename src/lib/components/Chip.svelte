<script lang="ts">
  let {
    label,
    selected = false,
    onclick
  }: { label: string; selected?: boolean; onclick?: () => void } = $props();
</script>

<button type="button" class="chip" class:selected aria-pressed={selected} {onclick}>
  {label}
</button>

<style>
  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    border-radius: 999px;
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm);
    white-space: nowrap;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .chip.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
</style>
