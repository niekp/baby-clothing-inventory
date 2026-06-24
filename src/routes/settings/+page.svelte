<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { SIZES } from '$lib/config';
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
  <p class="muted">Markeer de huidige maat per kind; deze licht op in de cijfers.</p>
  {#if msg}<p class="err" role="alert">{msg}</p>{/if}

  {#each data.children as child (child.id)}
    <div class="child">
      <input
        class="input name"
        value={child.name}
        onchange={(e) => patchChild(child.id, { name: e.currentTarget.value })}
        aria-label="Naam"
      />
      <select
        class="input size"
        value={child.current_size ?? ''}
        onchange={(e) => patchChild(child.id, { current_size: e.currentTarget.value || null })}
        aria-label="Huidige maat"
      >
        <option value="">— maat —</option>
        {#each SIZES as s (s)}<option value={String(s)}>{s}</option>{/each}
      </select>
      <button class="del" onclick={() => removeChild(child.id)} aria-label="Verwijderen"
        ><Icon name="x" size={18} /></button
      >
    </div>
  {/each}

  <div class="add">
    <input class="input" placeholder="Naam kind" bind:value={newName} aria-label="Naam nieuw kind" />
    <Button variant="primary" onclick={addChild} disabled={!newName.trim()}>Toevoegen</Button>
  </div>
</section>

<section>
  <h2>Maten</h2>
  <p class="muted">Vaste matenlijst (EU): {SIZES.join(', ')}.</p>
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
    gap: var(--space-2);
    align-items: center;
    margin-bottom: var(--space-2);
  }
  .child .name {
    flex: 1;
  }
  .child .size {
    width: 110px;
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
