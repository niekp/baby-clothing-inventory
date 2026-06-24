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

// moondream is Engels-native: laat 't model in 't Engels kiezen uit Engelse opties,
// en map die daarna op de Nederlandse app-opties. Het JSON-schema (FORMAT) dwingt
// via grammar af dat 't model exact één van de Engelse tokens teruggeeft.
const PROMPT = [
  "You are tagging one photo of a baby's or child's clothing item.",
  'Look at the photo and pick the single best value for each field from the allowed options.',
  'length means sleeve length for tops/rompers/bodysuits/sweaters/dresses, and leg length for trousers/shorts.',
  'Use "long" only for long sleeves or full-length legs; "short" for short or sleeveless (e.g. t-shirt,',
  'spaghetti-strap or tank romper, shorts); "na" when it does not apply (e.g. socks, hat).',
  'season: "summer", "winter", "mid-season", or "all-season".',
  'color: the single dominant color.',
  'Answer with the JSON object only.'
].join(' ');

// Engelse opties → Nederlandse app-enums. Schema-enum = de sleutels hieronder.
const TYPE_MAP: Record<string, string> = {
  onesie: 'romper',
  playsuit: 'boxpak',
  trousers: 'broek',
  shirt: 'shirt/top',
  sweater: 'trui',
  dress: 'jurk',
  skirt: 'rok',
  shorts: 'shorts',
  jacket: 'jas',
  pyjamas: 'pyjama',
  socks: 'sokken',
  hat: 'muts'
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

// JSON-schema (ollama structured outputs): grammar dwingt exact één Engels token af.
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
        format: FORMAT,
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
    type: mapTo(raw.type, TYPE_MAP),
    color: mapTo(raw.color, COLOR_MAP),
    length: mapTo(raw.length, LENGTH_MAP),
    season: mapTo(raw.season, SEASON_MAP)
  };
}
