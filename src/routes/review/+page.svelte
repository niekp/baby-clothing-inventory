<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import ReviewCard from '$lib/components/ReviewCard.svelte';
  import Button from '$lib/components/Button.svelte';
  import type { ItemFormValue } from '$lib/components/ItemFields.svelte';
  import type { ItemDTO } from '$lib/server/serialize';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Vast deck (snapshot); reset bij refresh (invalidateAll → nieuwe data.items).
  let deck = $state<ItemDTO[]>([]);
  let idx = $state(0);
  let newCount = $state(0);
  $effect(() => {
    deck = [...data.items];
    idx = 0;
    newCount = 0;
  });

  let current = $derived(deck[idx] ?? null);
  let done = $derived(idx >= deck.length);
  // reactief: weerspiegelt het huidige deck (ook na refresh), zodat de poll
  // 'nieuw' correct telt t.o.v. wat nu in het deck zit.
  let knownIds = $derived(new Set(deck.map((i) => i.id)));
  let errMsg = $state<string | null>(null);

  async function confirm(form: ItemFormValue) {
    const item = current;
    if (!item) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: form.size,
          type: form.type || null,
          length: form.length || null,
          seasons: form.seasons,
          quality: form.quality || null,
          color: form.color || null,
          ai_status: 'done'
        })
      });
      if (!res.ok) throw new Error();
      errMsg = null;
      idx++; // alleen vooruit bij succes — anders zou 't item stil terugkomen
    } catch {
      errMsg = 'Opslaan mislukt — probeer opnieuw';
    }
  }

  function skip() {
    errMsg = null;
    idx++; // blijft 'suggested' op de server; later opnieuw te reviewen
  }

  function refresh() {
    invalidateAll(); // $effect reset deck/idx/newCount
  }

  // Poll op nieuwe suggesties die binnenkomen terwijl je reviewt.
  onMount(() => {
    const timer = setInterval(async () => {
      if (done) return; // geen poll meer als het deck af is
      try {
        const res = await fetch('/api/items/inbox');
        if (!res.ok) return;
        const fresh = (await res.json()) as ItemDTO[];
        // tel t.o.v. het huidige deck (reactieve knownIds), niet de start-set
        newCount = fresh.filter((i) => !knownIds.has(i.id)).length;
      } catch {
        /* stil */
      }
    }, 20000);
    return () => clearInterval(timer);
  });
</script>

<header class="head">
  <a href="/" class="back" aria-label="Terug">←</a>
  <h1>Review</h1>
  {#if !done && deck.length}<span class="progress">{idx + 1}/{deck.length}</span>{/if}
</header>

{#if newCount > 0}
  <button class="new-banner" onclick={refresh}>{newCount} nieuw — vernieuw deck</button>
{/if}

{#if errMsg}<p class="err" role="alert">{errMsg}</p>{/if}

{#if deck.length === 0}
  <div class="empty">
    <p class="muted">Niets te reviewen 🎉</p>
    <Button variant="primary" href="/">Naar de kast</Button>
  </div>
{:else if done}
  <div class="empty">
    <p class="muted">Deck afgerond 🎉</p>
    {#if newCount > 0}
      <Button variant="primary" onclick={refresh}>Nieuwe items reviewen</Button>
    {:else}
      <Button variant="primary" href="/">Naar de kast</Button>
    {/if}
  </div>
{:else if current}
  {#key current.id}
    <ReviewCard item={current} onconfirm={confirm} onskip={skip} />
  {/key}
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .head h1 {
    margin: 0;
    font-size: var(--fs-xl);
    flex: 1;
  }
  .back {
    font-size: var(--fs-xl);
  }
  .progress {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-3);
  }
  .new-banner {
    display: block;
    width: 100%;
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    padding: var(--space-3);
    margin-bottom: var(--space-3);
    font-weight: 600;
  }
  .empty {
    text-align: center;
    padding: var(--space-6) var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
</style>
