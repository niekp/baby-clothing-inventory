const REMBG_URL = process.env.REMBG_URL ?? 'http://rembg:28872';
const TIMEOUT_MS = 60_000; // ruim genoeg voor birefnet-general (~47s)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CONN_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN']);

// true bij verbindingsfouten (sidecar nog niet op) — wel herproberen; HTTP/timeout niet
function isConnError(e: unknown): boolean {
  const code = (e as { cause?: { code?: string } })?.cause?.code;
  if (code && CONN_CODES.has(code)) return true;
  return e instanceof TypeError && /fetch failed/i.test(e.message);
}

// herhaalt bij verbindingsfouten over ~30s; faalt direct bij andere fouten
async function withConnRetry<T>(fn: () => Promise<T>, retries = 6, gapMs = 5000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt < retries && isConnError(e)) {
        await sleep(gapMs);
        continue;
      }
      throw e;
    }
  }
}

// Stuurt foto-bytes naar de sidecar en krijgt een PNG met alpha terug.
// Optioneel model (default = sidecar's REMBG_MODEL). Gooit bij fout/timeout.
export async function cutout(
  imageBytes: Uint8Array<ArrayBuffer>,
  model?: string
): Promise<Uint8Array<ArrayBuffer>> {
  return withConnRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = model
        ? `${REMBG_URL}/cutout?model=${encodeURIComponent(model)}`
        : `${REMBG_URL}/cutout`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: imageBytes,
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`rembg HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } finally {
      clearTimeout(timer);
    }
  });
}
