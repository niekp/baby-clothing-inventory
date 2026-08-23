import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearOutfitCutoutJob,
  countNotSharp,
  countQueuedCutouts,
  createDb,
  enqueueSharpenAll,
  setDbForTesting,
  type DB
} from '$lib/server/db';
import { getOutfit, listInspiration, listOutfits } from '$lib/server/outfits';
import * as photos from '$lib/server/photos';
import { readPhoto } from '$lib/server/photos';
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
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

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

function inspirationUpload(fields: Record<string, string> = {}, photo?: File): Request {
  return multipart({ kind: 'inspiration', ...fields }, photo ?? jpegFile());
}

async function postInspiration(fields: Record<string, string> = {}, photo?: File) {
  return (await POST({ request: inspirationUpload(fields, photo) } as never)).json();
}

describe('POST /api/outfits met kind=inspiration', () => {
  it('maakt een inspiratie-rij zonder naam en zet een isnet-job in de wachtrij', async () => {
    const res = await POST({ request: inspirationUpload({ note: 'mooie combi' }) } as never);
    expect(res.status).toBe(201);
    const dto = await res.json();

    expect(dto.kind).toBe('inspiration');
    expect(dto.note).toBe('mooie combi');
    expect(dto.favorite).toBe(0);
    expect(dto.is_photo).toBe(true);
    expect(dto).not.toHaveProperty('photo_orig');
    expect(dto).not.toHaveProperty('cutout_job');

    const row = getOutfit(dto.id)!;
    expect(row.name).toBe('');
    expect(row.size).toBeNull();
    expect(row.cutout_job).toBe('queued:');
    expect(existsSync(join(tmp, 'outfit_orig', `${dto.id}.jpg`))).toBe(true);
  });

  it('bewaart het origineel byte-identiek', async () => {
    const file = jpegFile();
    const dto = await postInspiration({}, file);
    const served = await readPhoto('outfit_orig', `${dto.id}.jpg`);
    expect(Buffer.from(served!.data).equals(Buffer.from(await file.arrayBuffer()))).toBe(true);
  });

  it('mag zonder notitie en negeert een meegestuurde maat', async () => {
    const dto = await postInspiration({ size: '68' });
    expect(dto.note).toBeNull();
    expect(getOutfit(dto.id)?.size).toBeNull();
  });

  it('weigert een niet-toegestane mime en een bestand boven 20 MB', async () => {
    const pdf = new File([new Uint8Array([1, 2, 3])], 'doc.pdf', { type: 'application/pdf' });
    const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'groot.jpg', {
      type: 'image/jpeg'
    });
    expect(await callStatus(() => POST({ request: inspirationUpload({}, pdf) } as never))).toBe(400);
    expect(await callStatus(() => POST({ request: inspirationUpload({}, big) } as never))).toBe(400);
    expect(listInspiration()).toHaveLength(0);
  });

  it('weigert een upload zonder afbeelding', async () => {
    expect(
      await callStatus(() => POST({ request: multipart({ kind: 'inspiration' }) } as never))
    ).toBe(400);
    expect(listInspiration()).toHaveLength(0);
  });

  it('blijft een naam eisen voor een eigen foto-outfit', async () => {
    expect(await callStatus(() => POST({ request: multipart({}, jpegFile()) } as never))).toBe(400);
  });

  it('accepteert een gewone foto-outfit-upload nog steeds', async () => {
    const res = await POST({ request: multipart({ name: 'Look', size: '68' }, jpegFile()) } as never);
    expect(res.status).toBe(201);
    const dto = await res.json();
    expect(dto.kind).toBe('own');
    expect(dto.name).toBe('Look');
    expect(getOutfit(dto.id)?.cutout_job).toBe('queued:');
  });

  it('laat een eigen foto-outfit met een niet-canonieke mime door (HEIC-terugval)', async () => {
    // capture.ts valt bij onleesbaar HEIC terug op het ruwe bestand; dat moet blijven werken
    for (const type of ['image/heic', 'image/jpg', '']) {
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'outfit.jpg', { type });
      const res = await POST({ request: multipart({ name: `Look ${type}` }, file) } as never);
      expect(res.status).toBe(201);
      expect((await res.json()).kind).toBe('own');
    }
  });

  it('weigert diezelfde mimes wél op het inspiratie-pad', async () => {
    for (const type of ['image/heic', 'image/jpg', '']) {
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'shot.jpg', { type });
      expect(await callStatus(() => POST({ request: inspirationUpload({}, file) } as never))).toBe(400);
    }
    expect(listInspiration()).toHaveLength(0);
  });

  it('weigert prototype-sleutels als mime', async () => {
    for (const type of ['__proto__', 'constructor']) {
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'shot.jpg', { type });
      expect(await callStatus(() => POST({ request: inspirationUpload({}, file) } as never))).toBe(400);
    }
    expect(listInspiration()).toHaveLength(0);
  });

  it('accepteert een mime met parameters', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'shot.jpg', {
      type: 'image/jpeg;charset=utf-8'
    });
    const res = await POST({ request: inspirationUpload({}, file) } as never);
    expect(res.status).toBe(201);
    expect(getOutfit((await res.json()).id)?.photo_orig).toMatch(/\.jpg$/);
  });

  it('weigert een onbekende soort in het formulier', async () => {
    expect(
      await callStatus(() => POST({ request: multipart({ kind: 'rommel' }, jpegFile()) } as never))
    ).toBe(400);
  });
});

describe('GET /api/outfits met kind', () => {
  it('geeft zonder kind alleen eigen outfits', async () => {
    await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never);
    await postInspiration();
    const listed = await (await GET({ url: new URL('http://x/api/outfits') } as never)).json();
    expect(listed.outfits).toHaveLength(1);
    expect(listed.outfits[0].kind).toBe('own');
  });

  it('geeft met kind=inspiration alleen inspiratie, zonder maten', async () => {
    await POST({ request: multipart({ name: 'Look', size: '68' }, jpegFile()) } as never);
    const insp = await postInspiration({ note: 'mooi' });
    const listed = await (
      await GET({ url: new URL('http://x/api/outfits?kind=inspiration') } as never)
    ).json();
    expect(listed.outfits.map((o: { id: number }) => o.id)).toEqual([insp.id]);
    expect(listed.sizes).toEqual([]);
  });

  it('weigert een onbekende kind-waarde', async () => {
    expect(
      await callStatus(() => GET({ url: new URL('http://x/api/outfits?kind=rommel') } as never))
    ).toBe(400);
  });
});

describe('PATCH /api/outfits/[id] met notitie en favoriet', () => {
  async function patch(id: number, body: unknown): Promise<Response> {
    const request = new Request(`http://x/api/outfits/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return PATCH({ params: { id: String(id) }, request } as never);
  }

  it('zet notitie en favoriet op inspiratie', async () => {
    const dto = await postInspiration();
    const patched = await (await patch(dto.id, { note: 'combi met geel', favorite: true })).json();
    expect(patched.note).toBe('combi met geel');
    expect(patched.favorite).toBe(1);

    const cleared = await (await patch(dto.id, { note: '', favorite: false })).json();
    expect(cleared.note).toBeNull(); // lege notitie → null, geen lege string
    expect(cleared.favorite).toBe(0);
  });

  it('weigert notitie of favoriet op een eigen outfit met 400', async () => {
    const own = await (
      await POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never)
    ).json();
    expect(await callStatus(() => patch(own.id, { note: 'nee' }))).toBe(400);
    expect(await callStatus(() => patch(own.id, { favorite: true }))).toBe(400);
    expect(getOutfit(own.id)?.note).toBeNull();
  });

  it('weigert naam of maat op inspiratie met 400', async () => {
    const dto = await postInspiration();
    expect(await callStatus(() => patch(dto.id, { name: 'nee' }))).toBe(400);
    expect(await callStatus(() => patch(dto.id, { size: '68' }))).toBe(400);
    expect(getOutfit(dto.id)?.name).toBe('');
  });

  it('weigert een favorite die geen boolean is', async () => {
    const dto = await postInspiration();
    expect(await callStatus(() => patch(dto.id, { favorite: 1 }))).toBe(400);
  });
});

describe('bestaande endpoints werken ongewijzigd voor inspiratie', () => {
  it('DELETE ruimt de rij en alle drie de bestanden op', async () => {
    const dto = await postInspiration();
    clearOutfitCutoutJob(dto.id);
    db.prepare("UPDATE outfit SET thumb_path = ?, cutout_status = 'done' WHERE id = ?").run(
      `${dto.id}.png`,
      dto.id
    );
    // cutout-PNG + webp-thumb zoals de worker die achterlaat
    mkdirSync(join(tmp, 'outfit'), { recursive: true });
    for (const name of [`${dto.id}.png`, `${dto.id}.webp`]) {
      writeFileSync(join(tmp, 'outfit', name), 'x');
    }

    const res = await DELETE({ params: { id: String(dto.id) } } as never);
    expect(res.status).toBe(204);
    expect(getOutfit(dto.id)).toBeUndefined();
    expect(existsSync(join(tmp, 'outfit_orig', `${dto.id}.jpg`))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', `${dto.id}.png`))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', `${dto.id}.webp`))).toBe(false);
  });

  // crash tussen het schrijven van de cutout en het zetten van thumb_path
  it('DELETE ruimt de cutout ook op als thumb_path NULL bleef', async () => {
    const dto = await postInspiration();
    clearOutfitCutoutJob(dto.id);
    mkdirSync(join(tmp, 'outfit'), { recursive: true });
    for (const name of [`${dto.id}.png`, `${dto.id}.webp`]) {
      writeFileSync(join(tmp, 'outfit', name), 'x');
    }
    expect(getOutfit(dto.id)?.thumb_path).toBeNull();

    const res = await DELETE({ params: { id: String(dto.id) } } as never);
    expect(res.status).toBe(204);
    expect(existsSync(join(tmp, 'outfit', `${dto.id}.png`))).toBe(false);
    expect(existsSync(join(tmp, 'outfit', `${dto.id}.webp`))).toBe(false);
  });

  it('recutout zet een birefnet-job in de wachtrij', async () => {
    const dto = await postInspiration();
    clearOutfitCutoutJob(dto.id);
    const res = await RECUTOUT({ params: { id: String(dto.id) } } as never);
    expect(res.status).toBe(202);
    expect(getOutfit(dto.id)?.cutout_job).toBe('queued:birefnet-general');
  });
});

describe('cutout-onderhoud pakt inspiratie mee', () => {
  it('telt inspiratie mee in nog-niet-scherp en de wachtrij', async () => {
    const dto = await postInspiration();
    expect(countQueuedCutouts()).toBe(1); // isnet-job van de upload
    clearOutfitCutoutJob(dto.id);
    expect(countQueuedCutouts()).toBe(0);
    expect(countNotSharp()).toBe(1); // nog geen birefnet-cutout
  });

  it('verbeter-alles zet inspiratie in de birefnet-wachtrij', async () => {
    const dto = await postInspiration();
    clearOutfitCutoutJob(dto.id);
    expect(enqueueSharpenAll()).toBe(1);
    expect(getOutfit(dto.id)?.cutout_job).toBe('queued:birefnet-general');
  });
});

describe('een mislukte opslag laat niets achter', () => {
  // schrijft het bestand en faalt daarna: zo test de assertie de opruiming echt,
  // in plaats van een bestand dat er nooit was
  function failAfterWrite() {
    vi.spyOn(photos, 'saveOutfitOrig').mockImplementation(async (id, buffer, ext) => {
      mkdirSync(join(tmp, 'outfit_orig'), { recursive: true });
      writeFileSync(join(tmp, 'outfit_orig', `${id}.${ext}`), buffer);
      throw new Error('schijf vol');
    });
  }

  it('rolt de rij en het bestand terug — inspiratie', async () => {
    failAfterWrite();
    expect(await callStatus(() => POST({ request: inspirationUpload() } as never))).toBe(500);
    expect(listInspiration()).toHaveLength(0);
    expect(existsSync(join(tmp, 'outfit_orig', '1.jpg'))).toBe(false);
  });

  it('rolt de rij en het bestand terug — eigen foto-outfit', async () => {
    failAfterWrite();
    expect(
      await callStatus(() => POST({ request: multipart({ name: 'Look' }, jpegFile()) } as never))
    ).toBe(500);
    expect(listOutfits()).toHaveLength(0);
    expect(existsSync(join(tmp, 'outfit_orig', '1.jpg'))).toBe(false);
  });
});
