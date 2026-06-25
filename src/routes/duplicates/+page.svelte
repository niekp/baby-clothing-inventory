<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { ItemDTO } from '$lib/server/serialize';
  import { thumbSrc, imgFallback } from '$lib/client/images';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let busy = $state(false);

  async function backfill() {
    busy = true;
    await fetch('/api/duplicates/backfill', { method: 'POST' }).catch(() => {});
    busy = false;
    await invalidateAll();
  }

  // 'keep' houdt het ene item en verwijdert het andere
  async function keep(drop: ItemDTO) {
    if (!confirm(`"${drop.type ?? 'item'}" maat ${drop.size} verwijderen?`)) return;
    busy = true;
    await fetch(`/api/items/${drop.id}`, { method: 'DELETE' }).catch(() => {});
    busy = false;
    await invalidateAll();
  }

  async function dismiss(a: ItemDTO, b: ItemDTO) {
    busy = true;
    await fetch('/api/duplicates/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: a.id, b: b.id })
    }).catch(() => {});
    busy = false;
    await invalidateAll();
  }
</script>

<header class="head">
  <a href="/settings" class="back" aria-label="Terug"><Icon name="arrow-left" size={22} /></a>
  <h1>Mogelijke dubbelen</h1>
</header>

{#if data.missing > 0}
  <div class="banner">
    <span>{data.missing} item{data.missing === 1 ? '' : 's'} nog niet geanalyseerd.</span>
    <Button variant="primary" onclick={backfill} disabled={busy}>
      {busy ? 'Bezig…' : 'Bereken nu'}
    </Button>
  </div>
{/if}

{#if data.pairs.length === 0}
  <p class="muted empty">Geen mogelijke dubbelen gevonden. Bevestigde "niet hetzelfde"-paren komen niet terug.</p>
{:else}
  <p class="muted">Tik <em>Houd deze</em> om de ander te verwijderen, of <em>Niet hetzelfde</em> om het paar te negeren.</p>
  {#each data.pairs as pair (`${pair.a.id}-${pair.b.id}`)}
    <div class="pair">
      <div class="sim">{Math.round(pair.score * 100)}% gelijkenis</div>
      <div class="two">
        {#each [pair.a, pair.b] as item, idx (item.id)}
          {@const other = idx === 0 ? pair.b : pair.a}
          <div class="side">
            <a class="photo" href={`/items/${item.id}`}>
              {#if thumbSrc(item)}
                <img src={thumbSrc(item)} alt="" onerror={(e) => imgFallback(e, item)} />
              {:else}
                <span class="ph"><Icon name="shirt" size={32} /></span>
              {/if}
            </a>
            <div class="meta">maat {item.size}{item.type ? ` · ${item.type}` : ''}</div>
            <Button variant="ghost" block onclick={() => keep(other)} disabled={busy}>Houd deze</Button>
          </div>
        {/each}
      </div>
      <Button variant="ghost" block onclick={() => dismiss(pair.a, pair.b)} disabled={busy}>
        <Icon name="x" size={16} /> Niet hetzelfde
      </Button>
    </div>
  {/each}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .head h1 {
    margin: 0;
    font-size: var(--fs-xl);
  }
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    background: var(--accent-soft);
    color: var(--accent);
    border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-4);
  }
  .empty {
    padding: var(--space-6) var(--space-2);
    text-align: center;
  }
  .pair {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .sim {
    font-size: var(--fs-sm);
    color: var(--text-muted);
    text-align: center;
    margin-bottom: var(--space-2);
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .photo {
    aspect-ratio: 1;
    background: var(--surface-2);
    border-radius: var(--radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .photo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: var(--space-2);
  }
  .ph {
    opacity: 0.4;
  }
  .meta {
    font-size: var(--fs-sm);
    text-align: center;
  }
</style>
