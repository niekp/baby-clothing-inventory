import { BASE, H, W, type Placed } from './outfit-canvas-space';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`kon afbeelding niet laden: ${url}`));
    img.src = url; // same-origin /photos → canvas raakt niet getaint
  });
}

// Vlakt de outfit-layout af tot een PNG-thumbnail (transparante achtergrond),
// in dezelfde logische ruimte als de canvas zodat 't exact matcht.
export async function renderOutfitThumb(placed: Placed[], thumbW = 500): Promise<Blob> {
  const s = thumbW / W;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * s);
  canvas.height = Math.round(H * s);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('geen 2d-context');

  for (const p of [...placed].sort((a, b) => a.z - b.z)) {
    let img: HTMLImageElement;
    try {
      img = await loadImage(p.url);
    } catch {
      continue; // ontbrekende cutout overslaan
    }
    const iw = BASE * p.scale * s;
    const ih = img.naturalWidth ? iw * (img.naturalHeight / img.naturalWidth) : iw;
    ctx.save();
    ctx.translate(p.x * s, p.y * s);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob faalde'))), 'image/png');
  });
}
