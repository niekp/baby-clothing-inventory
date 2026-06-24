<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/global.css';
  import NavBar from '$lib/components/NavBar.svelte';
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // Scan-modus is echt fullscreen: geen tab-chrome (ook op /scan-sub-routes).
  let hideChrome = $derived(page.url.pathname.startsWith('/scan'));
</script>

{#if hideChrome}
  {@render children()}
{:else}
  <div class="shell">
    <!-- main eerst in de DOM (content-first voor schermlezer/toetsenbord);
         nav krijgt visueel z'n plek via flex-order. -->
    <main>
      {@render children()}
    </main>
    <NavBar />
  </div>
{/if}

<style>
  .shell {
    display: flex;
    flex-direction: column; /* main boven, nav onderaan (= DOM-volgorde) */
    height: 100vh;
    height: 100dvh; /* vaste hoogte: main scrolt intern, nav blijft onderaan staan */
  }
  main {
    flex: 1;
    min-height: 0; /* sta toe dat main krimpt zodat overflow-scroll pakt (i.p.v. nav wegduwen) */
    overflow-y: auto;
    padding: var(--space-4);
  }

  @media (min-width: 768px) {
    .shell {
      flex-direction: row;
      height: 100vh;
      height: 100dvh;
    }
    main {
      order: 2; /* nav (order 0) links, content rechts; DOM blijft content-first */
      padding: var(--space-5);
    }
  }
</style>
