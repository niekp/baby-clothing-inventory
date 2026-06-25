<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { SIZES } from '$lib/config';
  import type { Child } from '$lib/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let newName = $state('');
  let msg = $state<string | null>(null);

  async function addChild() {
    const name = newName.trim();
    if (!name) return;
    msg = null;
    const res = await fetch('/api/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      newName = '';
      await invalidateAll();
    } else msg = 'Toevoegen mislukt';
  }

  async function patchChild(id: number, body: Record<string, unknown>) {
    msg = null;
    const res = await fetch(`/api/children/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) await invalidateAll();
    else msg = 'Wijziging mislukt'; // (input toont nog de niet-opgeslagen waarde)
  }

  function toggleSize(child: Child, size: string) {
    const next = child.current_sizes.includes(size)
      ? child.current_sizes.filter((s) => s !== size)
      : [...child.current_sizes, size];
    patchChild(child.id, { current_sizes: next });
  }

  async function removeChild(id: number) {
    if (!confirm('Kind verwijderen?')) return;
    msg = null;
    const res = await fetch(`/api/children/${id}`, { method: 'DELETE' });
    if (res.ok) await invalidateAll();
    else msg = 'Verwijderen mislukt';
  }
</script>

<h1>Instellingen</h1>

<section>
  <h2>Kinderen</h2>
  <p class="muted">
    Markeer de huidige maat/maten per kind; deze lichten op in de cijfers. Zit een kind
    tussen maten in, kies er dan meerdere.
  </p>
  {#if msg}<p class="err" role="alert">{msg}</p>{/if}

  {#each data.children as child (child.id)}
    <div class="child">
      <div class="row">
        <input
          class="input name"
          value={child.name}
          onchange={(e) => patchChild(child.id, { name: e.currentTarget.value })}
          aria-label="Naam"
        />
        <button class="del" onclick={() => removeChild(child.id)} aria-label="Verwijderen"
          ><Icon name="x" size={18} /></button
        >
      </div>
      <div class="sizes">
        {#each SIZES as s (s)}
          {@const size = String(s)}
          <Chip
            label={size}
            selected={child.current_sizes.includes(size)}
            onclick={() => toggleSize(child, size)}
          />
        {/each}
      </div>
    </div>
  {/each}

  <div class="add">
    <input class="input" placeholder="Naam kind" bind:value={newName} aria-label="Naam nieuw kind" />
    <Button variant="primary" onclick={addChild} disabled={!newName.trim()}>Toevoegen</Button>
  </div>
</section>

<style>
  h1 {
    margin: 0 0 var(--space-4);
    font-size: var(--fs-xl);
  }
  section {
    margin-bottom: var(--space-6);
    max-width: 520px;
  }
  h2 {
    font-size: var(--fs-lg);
    margin: 0 0 var(--space-2);
  }
  .err {
    color: var(--danger);
    font-size: var(--fs-sm);
    margin: 0 0 var(--space-2);
  }
  .child {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }
  .child .row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .child .name {
    flex: 1;
  }
  .child .sizes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .del {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--danger);
    width: 40px;
    height: 40px;
  }
  .add {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .add .input {
    flex: 1;
  }
</style>
