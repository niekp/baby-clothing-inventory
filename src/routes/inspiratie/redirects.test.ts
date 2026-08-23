import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, setDbForTesting, type DB } from '$lib/server/db';
import { createInspiration, createOutfit, getOutfit } from '$lib/server/outfits';
import { serializeOutfit } from '$lib/server/serialize';
import { load as loadInspirationDetail } from './[id]/+page';
import { load as loadOutfitDetail } from '../outfits/[id]/+page';
import { load as loadOutfitEdit } from '../outfits/[id]/edit/+page';

let db: DB;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

// de loads halen de rij via de eigen API; stub die met de echte serializer, zodat de test
// op de DTO-vorm leunt en niet op een handgemaakt object
function fetchFor(id: number): typeof fetch {
  return (async (url: string) => {
    if (url === '/api/items') return new Response('[]', { status: 200 });
    const row = getOutfit(id);
    if (!row) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify({ ...serializeOutfit(row), items: [] }), { status: 200 });
  }) as unknown as typeof fetch;
}

// SvelteKit's redirect() gooit; vang 'm als {status, location}
async function redirectOf(run: () => unknown): Promise<{ status: number; location: string }> {
  try {
    await run();
  } catch (e) {
    const r = e as { status?: number; location?: string };
    if (r.status && r.location) return { status: r.status, location: r.location };
    throw e;
  }
  throw new Error('geen redirect');
}

describe('soort-redirects tussen outfits en inspiratie', () => {
  it('stuurt een inspiratie-rij weg van de outfit-detailpagina', async () => {
    const id = createInspiration('mooie look').id;
    expect(
      await redirectOf(() =>
        loadOutfitDetail({ params: { id: String(id) }, fetch: fetchFor(id) } as never)
      )
    ).toEqual({ status: 307, location: `/inspiratie/${id}` });
  });

  it('stuurt een inspiratie-rij weg van de outfit-bewerkpagina', async () => {
    const id = createInspiration().id;
    expect(
      await redirectOf(() =>
        loadOutfitEdit({ params: { id: String(id) }, fetch: fetchFor(id) } as never)
      )
    ).toEqual({ status: 307, location: `/inspiratie/${id}` });
  });

  it('stuurt een eigen outfit weg van de inspiratie-detailpagina', async () => {
    const id = createOutfit('Zomerlook', []).id;
    expect(
      await redirectOf(() =>
        loadInspirationDetail({ params: { id: String(id) }, fetch: fetchFor(id) } as never)
      )
    ).toEqual({ status: 307, location: `/outfits/${id}` });
  });
});
