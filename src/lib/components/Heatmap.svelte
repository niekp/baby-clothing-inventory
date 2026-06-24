<script lang="ts">
  import { TYPES, SIZE_STRINGS, expandSize } from '$lib/config';
  import { buildItemQuery } from '$lib/filters';

  let {
    counts,
    highlightSizes = new Set<string>()
  }: {
    counts: { size: string; type: string | null; n: number }[];
    highlightSizes?: Set<string>;
  } = $props();

  const TYPE_SET = new Set<string>(TYPES);

  // lookups: per (size,type) en per size de "overig" (type buiten TYPES of null)
  let lookup = $derived.by(() => {
    const m = new Map<string, number>();
    const other = new Map<string, number>();
    let max = 0;
    for (const c of counts) {
      // dubbele maat (86/92) telt mee in beide maat-rijen (86 én 92)
      for (const size of expandSize(String(c.size))) {
        if (c.type && TYPE_SET.has(c.type)) {
          m.set(`${size}|${c.type}`, (m.get(`${size}|${c.type}`) ?? 0) + c.n);
          max = Math.max(max, m.get(`${size}|${c.type}`)!);
        } else {
          other.set(size, (other.get(size) ?? 0) + c.n);
          max = Math.max(max, other.get(size)!);
        }
      }
    }
    return { m, other, max };
  });

  function heat(n: number): string {
    if (n === 0) return 'transparent';
    const t = lookup.max ? n / lookup.max : 0;
    return `color-mix(in srgb, var(--accent) ${Math.round(15 + t * 70)}%, transparent)`;
  }

  // "overig" linkt naar de hele maat-bucket (er is geen canonieke filter voor
  // "types buiten de lijst"); toont dus ook de TYPES-items van die maat.
  function sizeLink(size: string): string {
    return `/?${buildItemQuery({ size: [size] })}`;
  }
  function typeLink(size: string, type: string): string {
    return `/?${buildItemQuery({ size: [size], type: [type] })}`;
  }
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th class="corner" scope="col">Maat</th>
        {#each TYPES as t (t)}<th scope="col" class="th-type">{t}</th>{/each}
        <th scope="col" class="th-type">overig</th>
      </tr>
    </thead>
    <tbody>
      {#each SIZE_STRINGS as size (size)}
        {@const o = lookup.other.get(size) ?? 0}
        <tr class:hl={highlightSizes.has(size)}>
          <th scope="row" class="th-size">{size}</th>
          {#each TYPES as t (t)}
            {@const n = lookup.m.get(`${size}|${t}`) ?? 0}
            <td>
              <a href={typeLink(size, t)} style:background={heat(n)} class:zero={n === 0}>{n || ''}</a>
            </td>
          {/each}
          <td>
            <a href={sizeLink(size)} style:background={heat(o)} class:zero={o === 0}>{o || ''}</a>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

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
  .th-type {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: left;
    color: var(--text-muted);
    font-weight: 600;
    padding: var(--space-2) 2px;
    white-space: nowrap;
  }
  .th-size {
    text-align: right;
    padding-right: var(--space-2);
    color: var(--text);
    font-weight: 700;
    position: sticky;
    left: 0;
    background: var(--bg);
  }
  tr.hl .th-size {
    background: var(--accent);
    color: var(--accent-ink);
    border-radius: var(--radius-sm);
  }
  td a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    height: 34px;
    border: 1px solid var(--border);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  td a.zero {
    color: var(--text-muted);
  }
  .corner {
    position: sticky;
    left: 0;
    background: var(--bg);
  }
</style>
