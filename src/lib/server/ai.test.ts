import { afterEach, describe, expect, it, vi } from 'vitest';
import { tagImage } from './ai';

const ollamaCfg = {
  provider: 'ollama' as const,
  ollamaUrl: 'http://ollama:11434',
  ollamaModel: 'moondream',
  ollamaThreads: 2,
  openrouterKey: '',
  openrouterModel: 'google/gemini-2.5-flash-lite'
};
const orCfg = { ...ollamaCfg, provider: 'openrouter' as const, openrouterKey: 'k' };

afterEach(() => vi.unstubAllGlobals());

describe('tagImage (ollama)', () => {
  it('maps English options to Dutch app values', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ response: '{"type":"Trousers","color":"Blue","length":"long","season":"summer"}' }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await tagImage('BASE64', ollamaCfg);
    expect(out).toEqual({ type: 'broek', color: 'blauw', length: 'lang', season: 'zomer' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://ollama:11434/api/generate');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('moondream');
    expect(body.format.properties.type.enum).toContain('trousers');
    expect(body.images).toEqual(['BASE64']);
  });

  it('drops unknown/unmappable fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ response: '{"type":"dress","color":"","length":"weird"}' }), { status: 200 }))
    );
    const out = await tagImage('B', ollamaCfg);
    expect(out).toEqual({ type: 'jurk', color: undefined, length: undefined, season: undefined });
  });

  it('throws on non-ok HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(tagImage('B', ollamaCfg)).rejects.toThrow(/HTTP 500/);
  });
});

describe('tagImage (openrouter)', () => {
  it('sends an image data-URL and maps the JSON content', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"type":"shorts","color":"blue","length":"short","season":"summer"}' } }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await tagImage('IMG64', orCfg);
    expect(out).toEqual({ type: 'shorts', color: 'blauw', length: 'kort', season: 'zomer' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('google/gemini-2.5-flash-lite');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content[1].image_url.url).toBe('data:image/jpeg;base64,IMG64');
  });

  it('throws when the key is missing', async () => {
    await expect(tagImage('B', { ...orCfg, openrouterKey: '' })).rejects.toThrow(/OPENROUTER_API_KEY/);
  });
});
