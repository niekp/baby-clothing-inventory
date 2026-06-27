<script lang="ts">
  import { TYPES, expandSize } from '$lib/config';
  import { buildItemQuery } from '$lib/filters';
  import type { ItemFilters } from '$lib/types';

  let {
    rows,
    size
  }: {
    rows: { size: string; type: string | null; season: string | null; n: number }[];
    size: string;
  } = $props();

  const COLS = ['zomer', 'tussenseizoen', 'winter'] as const;
  const COL_LABEL: Record<string, string> = {
    zomer: 'zomer',
    tussenseizoen: 'tussen',
    winter: 'winter'
  };
  const BUCKETS = [...TYPES, 'overig'];
  const TYPE_SET = new Set<string>(TYPES);

  function parseSeasons(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }

  // 'allseason' → alle drie; anders alleen de echte seizoenen (rest genegeerd)
  function effective(seasons: string[]): Set<string> {
    const out = new Set<string>();
    for (const s of seasons) {
      if (s === 'allseason') COLS.forEach((c) => out.add(c));
      else if ((COLS as readonly string[]).includes(s)) out.add(s);
    }
    return out;
  }

  // dubbele maat telt bij de kleinste component (62/68 → 62)
  let view = $derived.by(() => {
    const grid = new Map<string, number>();
    const rowTotal = new Map<string, number>();
    const colTotal = new Map<string, number>();
    let noSeason = 0;
    let max = 0;
    for (const r of rows) {
      if (expandSize(String(r.size))[0] !== size) continue;
      const bucket = r.type && TYPE_SET.has(r.type) ? r.type : 'overig';
      const eff = effective(parseSeasons(r.season));
      if (eff.size === 0) {
        noSeason += r.n;
        continue;
      }
      for (const c of eff) {
        const k = `${bucket}|${c}`;
        grid.set(k, (grid.get(k) ?? 0) + r.n);
        max = Math.max(max, grid.get(k)!);
        rowTotal.set(bucket, (rowTotal.get(bucket) ?? 0) + r.n);
        colTotal.set(c, (colTotal.get(c) ?? 0) + r.n);
      }
    }
    return { grid, rowTotal, colTotal, noSeason, max };
  });

  function heat(n: number): string {
    if (!n) return 'transparent';
    const t = view.max ? n / view.max : 0;
    return `color-mix(in srgb, var(--accent) ${Math.round(15 + t * 70)}%, transparent)`;
  }

  function cellLink(bucket: string, col: string): string {
    const f: ItemFilters = { size: [size], season: [col] };
    if (bucket !== 'overig') f.type = [bucket];
    return `/?${buildItemQuery(f)}`;
  }
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th class="corner" scope="col">Soort</th>
        {#each COLS as c (c)}<th scope="col" class="th-season">{COL_LABEL[c]}</th>{/each}
        <th scope="col" class="th-season">totaal</th>
      </tr>
    </thead>
    <tbody>
      {#each BUCKETS as bucket (bucket)}
        {@const rt = view.rowTotal.get(bucket) ?? 0}
        <tr>
          <th scope="row" class="th-type">{bucket}</th>
          {#each COLS as c (c)}
            {@const n = view.grid.get(`${bucket}|${c}`) ?? 0}
            <td>
              <a href={cellLink(bucket, c)} style:background={heat(n)} class:zero={n === 0}>{n || ''}</a>
            </td>
          {/each}
          <td class="rowtot">{rt || ''}</td>
        </tr>
      {/each}
      <tr class="coltot">
        <th scope="row" class="th-type">totaal</th>
        {#each COLS as c (c)}<td>{view.colTotal.get(c) || ''}</td>{/each}
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

{#if view.noSeason > 0}
  <p class="muted note">{view.noSeason} item{view.noSeason === 1 ? '' : 's'} zonder seizoen (niet in de tabel)</p>
{/if}

<style>
  .wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  th,
  td {
    padding: 0;
  }
  .th-season {
    text-align: center;
    color: var(--text-muted);
    font-weight: 600;
    padding: var(--space-2) var(--space-2);
    white-space: nowrap;
  }
  .th-type {
    text-align: right;
    padding-right: var(--space-2);
    color: var(--text);
    font-weight: 700;
    position: sticky;
    left: 0;
    background: var(--bg);
    white-space: nowrap;
  }
  td a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    height: 34px;
    border: 1px solid var(--border);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  td a.zero {
    color: var(--text-muted);
  }
  .rowtot,
  .coltot td {
    text-align: center;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .coltot .th-type {
    color: var(--text-muted);
  }
  .corner {
    position: sticky;
    left: 0;
    background: var(--bg);
  }
  .note {
    margin: var(--space-2) 0 0;
    font-size: var(--fs-sm);
  }
</style>
