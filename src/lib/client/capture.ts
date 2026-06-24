// Client-side foto-helpers voor de scan-flow. Geen server-imports.
import type { ItemDTO } from '$lib/server/serialize';

const MAX_DIM = 1600;
const QUALITY = 0.85;

// Tekent het huidige videoframe op een (geschaalde) canvas. Gooit als er nog geen frame is.
export function canvasFromVideo(video: HTMLVideoElement, maxDim = MAX_DIM): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('geen videoframe');
  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('geen 2d-context');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Detecteert een (vrijwel) zwart frame — symptoom van een dode iOS-stream.
export function canvasIsBlack(canvas: HTMLCanvasElement, threshold = 8): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  // klein sample-grid i.p.v. elke pixel
  const sw = 16;
  const sh = 16;
  const sample = document.createElement('canvas');
  sample.width = sw;
  sample.height = sh;
  const sctx = sample.getContext('2d');
  if (!sctx) return false;
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const { data } = sctx.getImageData(0, 0, sw, sh);
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (sw * sh) < threshold;
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob faalde'))),
      'image/jpeg',
      quality
    );
  });
}

// Desktop-upload: normaliseer naar JPEG via canvas. Lukt dat niet (bv. onleesbaar
// HEIC), val terug op het ruwe bestand (server probeert sharp, anders origineel-only).
export async function fileToNormalizedJpeg(file: File, maxDim = MAX_DIM): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('geen 2d-context');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvasToJpegBlob(canvas);
  } catch {
    return file;
  }
}

// Maakt een item aan met foto + maat. Gooit bij niet-ok respons.
export async function uploadItem(blob: Blob, size: string, filename = 'capture.jpg'): Promise<ItemDTO> {
  const fd = new FormData();
  fd.append('size', size);
  fd.append('photo', blob, filename);
  const res = await fetch('/api/items', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload mislukt (${res.status})`);
  return (await res.json()) as ItemDTO;
}
