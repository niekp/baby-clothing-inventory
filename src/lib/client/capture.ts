// Client-side foto-helpers voor de scan-flow. Geen server-imports.
import type { ItemDTO } from '$lib/server/serialize';

// Origineel: groot genoeg om te hergebruiken (bv. Vinted), niet absurd. De
// display-variant (klein webp) wordt server-side apart gemaakt.
const MAX_DIM = 3000;
const QUALITY = 0.92;

// Crop-kader, genormaliseerd (0-1) t.o.v. het getoonde video-element.
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Tekent het huidige videoframe op een (geschaalde) canvas. Gooit als er nog geen frame is.
// Met crop: alleen dat (op het scherm aangegeven) deel; rekent de object-fit:cover-
// transform terug naar echte videoframe-pixels.
export function canvasFromVideo(
  video: HTMLVideoElement,
  crop?: CropRect,
  maxDim = MAX_DIM
): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error('geen videoframe');

  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;
  if (crop) {
    // het scherm toont een object-fit:cover-uitsnede van het frame
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;
    const s = Math.max(cw / vw, ch / vh); // cover-schaal
    const offX = (vw * s - cw) / 2; // weggesneden rand links/boven (in scherm-px)
    const offY = (vh * s - ch) / 2;
    sx = (crop.x * cw + offX) / s;
    sy = (crop.y * ch + offY) / s;
    sw = (crop.w * cw) / s;
    sh = (crop.h * ch) / s;
    sx = Math.max(0, Math.min(sx, vw));
    sy = Math.max(0, Math.min(sy, vh));
    sw = Math.max(1, Math.min(sw, vw - sx));
    sh = Math.max(1, Math.min(sh, vh - sy));
  }

  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('geen 2d-context');
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Tekent een ImageBitmap (ImageCapture-still) op een (geschaalde) canvas. Met crop:
// genormaliseerde coördinaten (0-1) direct op de bitmap (zelfde FOV als de preview-band).
export function canvasFromBitmap(
  bitmap: ImageBitmap,
  crop?: CropRect,
  maxDim = MAX_DIM
): HTMLCanvasElement {
  const bw = bitmap.width;
  const bh = bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = bw;
  let sh = bh;
  if (crop) {
    sx = Math.max(0, Math.min(crop.x * bw, bw));
    sy = Math.max(0, Math.min(crop.y * bh, bh));
    sw = Math.max(1, Math.min(crop.w * bw, bw - sx));
    sh = Math.max(1, Math.min(crop.h * bh, bh - sy));
  }
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('geen 2d-context');
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
