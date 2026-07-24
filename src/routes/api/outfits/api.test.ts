import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearOutfitCutoutJob, createDb, setDbForTesting, type DB } from '$lib/server/db';
import { getOutfit } from '$lib/server/outfits';
import { GET, POST } from './+server';
import { DELETE, PATCH } from './[id]/+server';
import { POST as RECUTOUT } from './[id]/recutout/+server';

let tmp: string;
let db: DB;
const dirs: string[] = [];

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'bci-api-'));
  dirs.push(tmp);
  process.env.PHOTOS_DIR = tmp;
  db = createDb(':memory:');
  setDbForTesting(db);
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

// roept een handler aan en vangt een SvelteKit-error() als {status}
async function callStatus(fn: () => Promise<Response> | Response): Promise<number> {
  try {
    return (await fn()).status;
  } catch (e) {
    return (e as { status?: number }).status ?? 500;
  }
}

function multipart(fields: Record<string, string>, photo?: File): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  if (photo) fd.append('photo', photo);
  return new Request('http://x/api/outfits', { method: 'POST', body: fd });
}

function jpegFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'p.jpg', { type: 'image/jpeg' });
}

describe('POST /api/outfits', () => {
  it('multipart creates a photo-outfit and queues an isnet cutout', async () => {
    const res = await POST({ request: multipart({ name: 'Look', size: '68' }, jpegFile()) } as never);
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.is_photo).toBe(true);
    expect(dto.size).toBe('68');
    expect(dto).not.toHaveProperty('cutout_job'); // interne velden niet lekken
    expect(dto).not.toHaveProperty('photo_orig');

    const row = getOutfit(dto.id)!;
    expect(row.photo_orig).toBe(`${dto.id}.jpg`);
    expect(row.cutout_job).toBe('queued:'); // isnet in de wachtrij (fire-and-forget)
    expect(existsSync(join(tmp, 'outfit_orig', `${dto.id}.jpg`))).toBe(true);
  });

  it('JSON body still creates an item-outfit (is_photo false)', async () => {
    const req = new Request('http://x/api/outfits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sleep', items: [] })
    });
    const res = await POST({ request: req } as never);
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.is_photo).toBe(false);
    expect(getOutfit(dto.id)!.cutout_job).toBeNull();
  });

  it('rejects a photo-outfit without name or without photo (no row created)', async () => {
    expect(await callStatus(() => POST({ request: multipart({ name: '' }, jpegFile()) } as never))).toBe(400);
    expect(await callStatus(() => POST({ request: multipart({ name: 'X' }) } as never))).toBe(400);
    // geen enkele outfit aangemaakt
    const listed = await (await GET({ url: new URL('http://x/api/outfits') } as never)).json();
    expect(listed.outfits.length).toBe(0);
  });
});

describe('PATCH /api/outfits/[id] hybride-guard', () => {
  it('rejects an items payload on a photo-outfit', async () => {
    const res = await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never);
    const { id } = await res.json();
    const req = new Request(`http://x/api/outfits/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: [] })
    });
    expect(await callStatus(() => PATCH({ params: { id: String(id) }, request: req } as never))).toBe(400);
  });

  it('allows name/size on a photo-outfit', async () => {
    const res = await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never);
    const { id } = await res.json();
    const req = new Request(`http://x/api/outfits/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Look 2', size: '74' })
    });
    const patched = await (await PATCH({ params: { id: String(id) }, request: req } as never)).json();
    expect(patched.name).toBe('Look 2');
    expect(patched.size).toBe('74');
  });
});

describe('POST /api/outfits/[id]/recutout', () => {
  it('queues a sharp (birefnet) cutout for a photo-outfit (once the isnet job cleared)', async () => {
    const { id } = await (await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never)).json();
    clearOutfitCutoutJob(id); // simuleer: isnet-cutout klaar, geen lopende job meer
    const res = await RECUTOUT({ params: { id: String(id) } } as never);
    expect(res.status).toBe(202);
    expect(getOutfit(id)!.cutout_job).toBe('queued:birefnet-general');
  });

  it('is a no-op while a cutout job is already in flight (no clobber)', async () => {
    const { id } = await (await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never)).json();
    // isnet staat nog in de wachtrij ('queued:') → recutout mag die niet overschrijven
    expect(getOutfit(id)!.cutout_job).toBe('queued:');
    const res = await RECUTOUT({ params: { id: String(id) } } as never);
    expect(res.status).toBe(202);
    expect(getOutfit(id)!.cutout_job).toBe('queued:'); // ongewijzigd
  });

  it('rejects recutout on an item-outfit (409)', async () => {
    const req = new Request('http://x/api/outfits', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sleep', items: [] })
    });
    const { id } = await (await POST({ request: req } as never)).json();
    expect(await callStatus(() => RECUTOUT({ params: { id: String(id) } } as never))).toBe(409);
  });
});

describe('DELETE /api/outfits/[id]', () => {
  it('removes a photo-outfit source file', async () => {
    const res = await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never);
    const { id } = await res.json();
    expect(existsSync(join(tmp, 'outfit_orig', `${id}.jpg`))).toBe(true);
    const del = await DELETE({ params: { id: String(id) } } as never);
    expect(del.status).toBe(204);
    expect(getOutfit(id)).toBeUndefined();
    expect(existsSync(join(tmp, 'outfit_orig', `${id}.jpg`))).toBe(false);
  });
});
