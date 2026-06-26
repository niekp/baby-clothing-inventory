import { afterEach, describe, expect, it, vi } from 'vitest';
import { tagImage } from './ai';

const orCfg = { openrouterKey: 'k', openrouterModel: 'google/gemini-2.5-flash-lite' };

afterEach(() => vi.unstubAllGlobals());

describe('tagImage (openrouter)', () => {
  it('maps English options to Dutch app values', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"type":"Trousers","color":"Blue","length":"long","season":"summer"}' } }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const out = await tagImage('BASE64', orCfg);
    expect(out).toEqual({ type: 'broek', color: 'blauw', length: 'lang', season: 'zomer' });
  });

  it('drops unknown/unmappable fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"type":"dress","color":"","length":"weird"}' } }] }),
          { status: 200 }
        )
      )
    );
    const out = await tagImage('B', orCfg);
    expect(out).toEqual({ type: 'jurk', color: undefined, length: undefined, season: undefined });
  });

  it('throws on non-ok HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await expect(tagImage('B', orCfg)).rejects.toThrow(/HTTP 500/);
  });

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
