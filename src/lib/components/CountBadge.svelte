<script lang="ts">
  let { count }: { count: number } = $props();
</script>

{#if count > 0}<span class="count-badge">{count}</span>{/if}

<style>
  .count-badge {
    display: inline-block;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 11px;
    font-weight: 700;
    line-height: 18px;
    text-align: center;
  }
</style>
