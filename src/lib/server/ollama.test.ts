import { afterEach, describe, expect, it, vi } from 'vitest';
import { tagImage } from './ollama';

const cfg = { url: 'http://ollama:11434', model: 'moondream', threads: 2 };

afterEach(() => vi.unstubAllGlobals());

describe('tagImage', () => {
  it('sends a vision request and parses normalized suggestions', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ response: '{"type":"Broek","color":"Blauw","length":"lang","season":"zomer"}' }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await tagImage('BASE64', cfg);
    expect(out).toEqual({ type: 'broek', color: 'blauw', length: 'lang', season: 'zomer' });

    // request shape
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama:11434/api/generate');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('moondream');
    expect(body.format).toBe('json');
    expect(body.keep_alive).toBe(0);
    expect(body.images).toEqual(['BASE64']);
    expect(body.options.num_thread).toBe(2);
  });

  it('drops empty/unknown fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ response: '{"type":"jurk","color":"","length":"onbekend"}' }), { status: 200 }))
    );
    const out = await tagImage('B', cfg);
    expect(out).toEqual({ type: 'jurk', color: undefined, length: undefined, season: undefined });
  });

  it('throws on non-ok HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(tagImage('B', cfg)).rejects.toThrow(/HTTP 500/);
  });

  it('throws on unparseable response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ response: 'not json' }), { status: 200 }))
    );
    await expect(tagImage('B', cfg)).rejects.toThrow();
  });
});
