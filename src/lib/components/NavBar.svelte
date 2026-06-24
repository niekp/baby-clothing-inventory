<script lang="ts">
  import { page } from '$app/state';

  const tabs = [
    { href: '/', label: 'Kast', icon: '👕' },
    { href: '/outfits', label: 'Outfits', icon: '🧩' },
    { href: '/scan', label: 'Scan', icon: '📸', primary: true },
    { href: '/stats', label: 'Cijfers', icon: '📊' },
    { href: '/settings', label: 'Instellingen', icon: '⚙️' }
  ];

  function isActive(href: string): boolean {
    const p = page.url.pathname;
    return href === '/' ? p === '/' : p === href || p.startsWith(href + '/');
  }
</script>

<nav class="navbar" aria-label="Hoofdnavigatie">
  {#each tabs as tab (tab.href)}
    <a
      href={tab.href}
      class="tab"
      class:active={isActive(tab.href)}
      class:primary={tab.primary}
      aria-current={isActive(tab.href) ? 'page' : undefined}
    >
      <span class="icon">{tab.icon}</span>
      <span class="label">{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .navbar {
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding-bottom: env(safe-area-inset-bottom); /* vrij van home-indicator (viewport-fit=cover) */
  }
  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--space-2) 0;
    color: var(--text-muted);
    font-size: var(--fs-sm);
    min-height: var(--nav-h);
  }
  .tab .icon {
    font-size: 22px;
    line-height: 1;
  }
  .tab.active {
    color: var(--accent);
  }
  .tab.primary .icon {
    background: var(--accent);
    color: var(--accent-ink);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-2);
    margin-top: -18px;
  }
  .tab.primary.active .icon {
    filter: brightness(1.05);
  }

  /* Desktop: verticale sidebar links */
  @media (min-width: 768px) {
    .navbar {
      flex-direction: column;
      border-top: none;
      border-right: 1px solid var(--border);
      width: var(--sidebar-w);
      height: 100%;
      padding: var(--space-4) var(--space-2);
      gap: var(--space-1);
    }
    .tab {
      flex: 0 0 auto;
      flex-direction: row;
      justify-content: flex-start;
      gap: var(--space-3);
      min-height: 0;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius);
      font-size: var(--fs-base);
    }
    .tab.active {
      background: var(--accent-soft);
    }
    .tab .icon {
      font-size: 20px;
    }
    .tab.primary .icon {
      width: 32px;
      height: 32px;
      margin-top: 0;
      box-shadow: none;
    }
  }
</style>
