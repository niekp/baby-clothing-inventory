<script lang="ts" module>
  export interface Capture {
    key: number;
    url: string; // objectURL voor de thumbnail
    size: string;
    status: 'pending' | 'ok' | 'failed';
    id?: number; // server-id zodra aangemaakt
  }
</script>

<script lang="ts">
  let {
    captures,
    onthumb
  }: { captures: Capture[]; onthumb: (c: Capture) => void } = $props();

  // nieuwste eerst, max 3
  let recent = $derived([...captures].slice(-3).reverse());
</script>

<div class="strip">
  <div class="thumbs">
    {#each recent as c (c.key)}
      <button
        class="thumb"
        class:pending={c.status === 'pending'}
        class:failed={c.status === 'failed'}
        onclick={() => onthumb(c)}
        aria-label={`Item maat ${c.size}, ${c.status}`}
      >
        <img src={c.url} alt="" />
        {#if c.status === 'pending'}<span class="badge">…</span>{/if}
        {#if c.status === 'failed'}<span class="badge err">!</span>{/if}
      </button>
    {/each}
  </div>
  <span class="count">{captures.length} toegev.</span>
</div>

<style>
  .strip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .thumbs {
    display: flex;
    gap: var(--space-2);
  }
  .thumb {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.6);
    padding: 0;
    background: #222;
  }
  .thumb.pending {
    opacity: 0.6;
  }
  .thumb.failed {
    border-color: var(--danger);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .badge {
    position: absolute;
    right: 1px;
    bottom: 1px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 11px;
    line-height: 1;
    padding: 1px 4px;
    border-radius: 6px;
  }
  .badge.err {
    background: var(--danger);
  }
  .count {
    color: #fff;
    font-size: var(--fs-sm);
    white-space: nowrap;
  }
</style>
