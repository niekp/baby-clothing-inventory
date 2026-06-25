import sharp from 'sharp';

// Kleur-vingerafdruk van een cutout: HS-histogram (12 hue × 4 sat bins) over
// alleen de kledingpixels (alpha-masker). Onderscheidt gelijk-gevormde stukken
// van verschillende kleur — wat CLIP juist niet doet.
const H_BINS = 12;
const S_BINS = 4;
export const HIST_BINS = H_BINS * S_BINS;
const ALPHA_MIN = 32; // onder deze alpha = achtergrond

function rgbToHs(r: number, g: number, b: number): [number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s];
}

// Genormaliseerd HS-histogram uit cutout-PNG-bytes (met alpha). Lege/onleesbare
// invoer → nul-vector (matcht dan nooit).
export async function colorHistogram(png: Uint8Array): Promise<Float32Array> {
  const hist = new Float32Array(HIST_BINS);
  let count = 0;
  try {
    const { data, info } = await sharp(Buffer.from(png))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ch = info.channels; // 4 (RGBA) na ensureAlpha
    for (let i = 0; i + 3 < data.length; i += ch) {
      if (data[i + 3] < ALPHA_MIN) continue; // achtergrond
      const [h, s] = rgbToHs(data[i], data[i + 1], data[i + 2]);
      const hb = Math.min(H_BINS - 1, Math.floor(h * H_BINS));
      const sb = Math.min(S_BINS - 1, Math.floor(s * S_BINS));
      hist[hb * S_BINS + sb] += 1;
      count++;
    }
  } catch {
    return hist;
  }
  if (count > 0) for (let i = 0; i < HIST_BINS; i++) hist[i] /= count;
  return hist;
}

// Histogram-intersectie: 1 = identieke kleurverdeling, 0 = geen overlap.
export function histIntersection(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.min(a[i], b[i]);
  return sum;
}
