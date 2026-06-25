import type { AiSuggestions } from '$lib/types';

// Het model praat Engels (kiest uit Engelse opties); wij mappen daarna op de
// Nederlandse app-enums. Werkt voor beide providers met dezelfde prompt.
const PROMPT = [
  "You are tagging one photo of a baby's or child's clothing item.",
  'Look at the photo and pick the single best value for each field from the allowed options.',
  'type: onesie, playsuit, trousers, shirt, sweater, dress, skirt, shorts, jacket.',
  'color: white, black, grey, beige, brown, red, orange, yellow, green, blue, purple, pink, multicolor.',
  'length means sleeve length for tops/rompers/bodysuits/sweaters/dresses, and leg length for trousers/shorts.',
  'Use "long" only for long sleeves or full-length legs; "short" for short or sleeveless (e.g. t-shirt,',
  'spaghetti-strap or tank romper, shorts); "na" when it does not apply.',
  'season: "summer", "winter", "mid-season", or "all-season".',
  'color is the single dominant color.',
  'Answer with the JSON object only.'
].join(' ');

// Engelse opties → Nederlandse app-enums. Schema-enum = de sleutels hieronder.
const TYPE_MAP: Record<string, string> = {
  onesie: 'romper',
  playsuit: 'boxpak',
  trousers: 'broek',
  shirt: 'shirt',
  sweater: 'trui',
  dress: 'jurk',
  skirt: 'rok',
  shorts: 'shorts',
  jacket: 'jas'
};
const LENGTH_MAP: Record<string, string> = { long: 'lang', short: 'kort', na: 'nvt' };
const SEASON_MAP: Record<string, string> = {
  summer: 'zomer',
  winter: 'winter',
  'mid-season': 'tussenseizoen',
  'all-season': 'allseason'
};
const COLOR_MAP: Record<string, string> = {
  white: 'wit',
  black: 'zwart',
  grey: 'grijs',
  beige: 'beige',
  brown: 'bruin',
  red: 'rood',
  orange: 'oranje',
  yellow: 'geel',
  green: 'groen',
  blue: 'blauw',
  purple: 'paars',
  pink: 'roze',
  multicolor: 'multicolor'
};

// JSON-schema voor ollama structured outputs: grammar dwingt exact één token af.
const FORMAT = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: Object.keys(TYPE_MAP) },
    color: { type: 'string', enum: Object.keys(COLOR_MAP) },
    length: { type: 'string', enum: Object.keys(LENGTH_MAP) },
    season: { type: 'string', enum: Object.keys(SEASON_MAP) }
  },
  required: ['type', 'color', 'length', 'season']
};

// Map een Engels token op de Nederlandse optie; onbekend → undefined (veld leeg).
function mapTo(v: unknown, table: Record<string, string>): string | undefined {
  return typeof v === 'string' ? table[v.trim().toLowerCase()] : undefined;
}

type Provider = 'openrouter' | 'ollama';
interface AiConfig {
  provider: Provider;
  ollamaUrl: string;
  ollamaModel: string;
  ollamaThreads: number;
  openrouterKey: string;
  openrouterModel: string;
}

function config(): AiConfig {
  const env = process.env;
  const provider: Provider =
    env.AI_PROVIDER === 'openrouter' || env.AI_PROVIDER === 'ollama'
      ? env.AI_PROVIDER
      : env.OPENROUTER_API_KEY
        ? 'openrouter'
        : 'ollama';
  return {
    provider,
    ollamaUrl: env.OLLAMA_URL ?? 'http://localhost:11434',
    ollamaModel: env.OLLAMA_MODEL ?? 'moondream',
    ollamaThreads: Number(env.OLLAMA_THREADS ?? 2),
    openrouterKey: env.OPENROUTER_API_KEY ?? '',
    openrouterModel: env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite'
  };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  return res.json();
}

// OpenRouter (chat/completions): foto als data-URL, JSON-object terug.
async function viaOpenRouter(jpegBase64: string, cfg: AiConfig): Promise<Record<string, unknown>> {
  if (!cfg.openrouterKey) throw new Error('OPENROUTER_API_KEY ontbreekt');
  const res = await postJson(
    'https://openrouter.ai/api/v1/chat/completions',
    { Authorization: `Bearer ${cfg.openrouterKey}` },
    {
      model: cfg.openrouterModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${jpegBase64}` } }
          ]
        }
      ]
    },
    45_000
  );
  const content = (res as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message
    ?.content;
  if (typeof content !== 'string') throw new Error('openrouter: geen content');
  return JSON.parse(content) as Record<string, unknown>;
}

// Ollama (/api/generate): lokaal vision-model, grammar-constrained output.
async function viaOllama(jpegBase64: string, cfg: AiConfig): Promise<Record<string, unknown>> {
  const res = await postJson(
    `${cfg.ollamaUrl}/api/generate`,
    {},
    {
      model: cfg.ollamaModel,
      prompt: PROMPT,
      images: [jpegBase64],
      format: FORMAT,
      stream: false,
      keep_alive: 0,
      options: { num_thread: cfg.ollamaThreads, temperature: 0.1 }
    },
    180_000
  );
  const body = res as { response?: string };
  if (typeof body.response !== 'string') throw new Error('ollama: geen response-veld');
  return JSON.parse(body.response) as Record<string, unknown>;
}

// Tagt een (JPEG-)foto en geeft genormaliseerde suggesties terug. Gooit bij
// netwerk-/parse-/HTTP-fout (de worker zet 't item dan op 'failed').
export async function tagImage(jpegBase64: string, cfg: AiConfig = config()): Promise<AiSuggestions> {
  const raw =
    cfg.provider === 'openrouter'
      ? await viaOpenRouter(jpegBase64, cfg)
      : await viaOllama(jpegBase64, cfg);
  return {
    type: mapTo(raw.type, TYPE_MAP),
    color: mapTo(raw.color, COLOR_MAP),
    length: mapTo(raw.length, LENGTH_MAP),
    season: mapTo(raw.season, SEASON_MAP)
  };
}
