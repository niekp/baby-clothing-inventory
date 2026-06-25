import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { colorHistogram, histIntersection, HIST_BINS } from './colorhist';

function solid(r: number, g: number, b: number, alpha = 1, size = 24): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha } } })
    .png()
    .toBuffer();
}

describe('colorhist', () => {
  it('identieke kleur → intersectie ~1, andere kleur → ~0', async () => {
    const red = await colorHistogram(await solid(220, 20, 20));
    const red2 = await colorHistogram(await solid(220, 20, 20));
    const blue = await colorHistogram(await solid(20, 20, 220));
    expect(histIntersection(red, red2)).toBeCloseTo(1, 5);
    expect(histIntersection(red, blue)).toBeLessThan(0.05);
  });

  it('negeert transparante achtergrond (lege hist matcht nooit)', async () => {
    const transparent = await colorHistogram(await solid(255, 0, 0, 0));
    expect(Array.from(transparent).every((v) => v === 0)).toBe(true);
    expect(histIntersection(transparent, transparent)).toBe(0);
  });

  it('telt alleen niet-transparante kledingpixels', async () => {
    const sq = await solid(220, 20, 20, 1, 20);
    const png = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: sq, top: 10, left: 10 }])
      .png()
      .toBuffer();
    const h = await colorHistogram(png);
    expect(h.length).toBe(HIST_BINS);
    expect(Array.from(h).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5); // genormaliseerd
  });

  it('onleesbare invoer → nul-vector', async () => {
    const h = await colorHistogram(new Uint8Array([1, 2, 3]));
    expect(Array.from(h).every((v) => v === 0)).toBe(true);
  });
});
