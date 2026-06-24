import type { AiSuggestions } from '$lib/types';

const TIMEOUT_MS = 180_000;

interface OllamaConfig {
  url: string;
  model: string;
  threads: number;
}

function config(): OllamaConfig {
  return {
    url: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL ?? 'moondream',
    threads: Number(process.env.OLLAMA_THREADS ?? 2)
  };
}

const PROMPT = [
  'Bekijk dit kledingstuk voor een baby/kind.',
  'Antwoord met JSON met exact deze velden:',
  '- "type": soort kledingstuk in het Nederlands (bv. broek, shirt, jurk, romper, body, trui, jas, rok, shorts, pyjama, sokken, muts).',
  '- "color": hoofdkleur in het Nederlands, één woord.',
  '- "length": "lang", "kort" of "nvt".',
  '- "season": "zomer", "winter", "tussenseizoen" of "allseason".',
  'Alleen de JSON, geen uitleg.'
].join(' ');

// Trim + normaliseer een AI-veld; leeg/onbekend → undefined.
function clean(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  return s === '' || s === 'onbekend' ? undefined : s;
}

// Roept moondream aan met een base64-foto en geeft genormaliseerde suggesties terug.
// Gooit bij netwerk-/parse-/HTTP-fout (de worker zet 't item dan op 'failed').
export async function tagImage(imageBase64: string, cfg: OllamaConfig = config()): Promise<AiSuggestions> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: cfg.model,
        prompt: PROMPT,
        images: [imageBase64],
        format: 'json',
        stream: false,
        keep_alive: 0,
        options: { num_thread: cfg.threads, temperature: 0.1 }
      })
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const body = (await res.json()) as { response?: string };
  if (typeof body.response !== 'string') throw new Error('ollama: geen response-veld');
  const raw = JSON.parse(body.response) as Record<string, unknown>;

  return {
    type: clean(raw.type),
    color: clean(raw.color),
    length: clean(raw.length),
    season: clean(raw.season)
  };
}
