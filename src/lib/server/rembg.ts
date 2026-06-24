const REMBG_URL = process.env.REMBG_URL ?? 'http://rembg:28872';
// Ruime timeout: birefnet-general (~47s) past hierbinnen; isnet ~2s. Voorkomt
// dat een vastgelopen sidecar de serieel-worker parkeert.
const TIMEOUT_MS = 60_000;

// Stuurt foto-bytes naar de sidecar en krijgt een PNG met alpha terug.
// Optioneel model (default = sidecar's REMBG_MODEL). Gooit bij fout/timeout.
export async function cutout(
  imageBytes: Uint8Array<ArrayBuffer>,
  model?: string
): Promise<Uint8Array<ArrayBuffer>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = model ? `${REMBG_URL}/cutout?model=${encodeURIComponent(model)}` : `${REMBG_URL}/cutout`;
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
}

// Vraagt de CLIP-embedding (L2-genormaliseerd) van een afbeelding op. Gooit bij fout/timeout.
export async function embed(imageBytes: Uint8Array<ArrayBuffer>): Promise<Float32Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${REMBG_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: imageBytes,
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`embed HTTP ${res.status}`);
    const data = (await res.json()) as { embedding: number[] };
    // CLIP ViT-B/32 → 512-dim. Wijkt dat af, dan klopt het model-contract niet:
    // hard falen i.p.v. een verkeerd-gevormde vector in de DB schrijven.
    if (!Array.isArray(data.embedding) || data.embedding.length !== 512) {
      throw new Error(`embed: onverwachte vector-lengte ${data.embedding?.length}`);
    }
    return Float32Array.from(data.embedding);
  } finally {
    clearTimeout(timer);
  }
}
