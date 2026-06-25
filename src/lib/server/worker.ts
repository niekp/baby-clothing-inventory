import {
  claimNextProcessing,
  failTagging,
  finishTagging,
  getItem,
  itemsMissingEmbedding,
  listCutoutItems,
  setEmbedding,
  sweepStuckWorking,
  updateItem
} from './db';
import sharp from 'sharp';
import { normalizeCutout, readPhoto, saveCutout } from './photos';
import { tagImage } from './ai';
import { cutout, embed } from './rembg';
import { colorHistogram } from './colorhist';

const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 3000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Verwerkt één processing-item. Retourneert false als de queue leeg was.
// Concurrency 1: de caller roept dit serieel aan.
export async function processOne(): Promise<boolean> {
  const item = claimNextProcessing();
  if (!item) return false;

  // Geen display-foto → niets te taggen/cutten; netjes afsluiten.
  if (!item.photo_display) {
    updateItem(item.id, { ai_status: 'done' });
    return true;
  }
  const file = await readPhoto('disp', item.photo_display);
  if (!file) {
    updateItem(item.id, { ai_status: 'failed' });
    return true;
  }

  // cutout eerst: vrijstaand kledingstuk tagt beter dan een portretfoto met kamer.
  const cut = await generateCutout(item.id, file.data);

  // tag op de geflatten cutout (val terug op displayfoto bij cutout-fout)
  try {
    const jpeg = await pngToJpeg(cut ?? file.data);
    await embedItem(item.id, jpeg, cut); // dubbel-detectie; niet-fataal voor tagging
    const suggestions = await tagImage(jpeg.toString('base64'));
    if (!finishTagging(item.id, JSON.stringify(suggestions))) {
      console.info(`[worker] item ${item.id} ondertussen handmatig afgehandeld — AI-resultaat genegeerd`);
    }
  } catch (e) {
    console.error(`[worker] item ${item.id} tagging mislukt:`, e);
    try {
      failTagging(item.id);
    } catch (e2) {
      // db onbereikbaar: item blijft 'working' tot de sweep bij herstart
      console.error(`[worker] item ${item.id} kon niet op failed gezet worden:`, e2);
    }
  }
  return true;
}

// Vlakt een (cutout-)PNG op wit af tot JPEG — invoer voor AI-tagging én embedding.
export function pngToJpeg(png: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(png)).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
}

// Maakt de genormaliseerde cutout via de sidecar (optioneel ander model). Niet-fataal.
// Retourneert de PNG-bytes of null bij fout/verwijderd item.
export async function generateCutout(
  id: number,
  displayBytes: Uint8Array<ArrayBuffer>,
  model?: string
): Promise<Uint8Array | null> {
  try {
    const png = await cutout(displayBytes, model);
    if (!getItem(id)) return null; // item ondertussen verwijderd → geen wees-cutout
    const norm = await normalizeCutout(png).catch(() => png); // uniform vierkant; niet-fataal
    const name = await saveCutout(id, norm);
    updateItem(id, { cutout_path: name, cutout_status: 'done' });
    return norm;
  } catch (e) {
    console.error(`[worker] item ${id} cutout mislukt:`, e);
    try {
      updateItem(id, { cutout_status: 'failed' });
    } catch {
      /* db onbereikbaar */
    }
    return null;
  }
}

// Berekent + bewaart embedding (+ kleur-histogram als er een cutout-PNG is). Niet-fataal.
export async function embedItem(
  id: number,
  jpeg: Buffer,
  cutPng: Uint8Array | null
): Promise<boolean> {
  try {
    const vec = await embed(new Uint8Array(jpeg));
    const hist = cutPng ? await colorHistogram(cutPng) : null;
    if (!getItem(id)) return false; // item ondertussen verwijderd
    setEmbedding(id, vec, hist);
    return true;
  } catch (e) {
    console.error(`[worker] item ${id} embedding mislukt:`, e);
    return false;
  }
}

// Embedding + histogram rechtstreeks uit een cutout-PNG (flatten → jpeg → embed).
export async function embedFromCutout(id: number, cutPng: Uint8Array): Promise<boolean> {
  return embedItem(id, await pngToJpeg(cutPng), cutPng);
}

// Berekent embeddings voor bestaande items mét cutout zonder embedding (eenmalig
// inhalen). Serieel; de kast is klein. Retourneert tellingen.
export async function backfillEmbeddings(): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const id of itemsMissingEmbedding()) {
    const item = getItem(id);
    if (!item?.cutout_path) {
      failed++;
      continue;
    }
    const file = await readPhoto('cutout', item.cutout_path); // cutout-PNG (met alpha)
    if (!file) {
      failed++;
      continue;
    }
    try {
      (await embedFromCutout(id, file.data)) ? done++ : failed++;
    } catch {
      failed++;
    }
  }
  return { done, failed };
}

// Her-normaliseert bestaande cutouts (uniform vierkant) en herberekent embedding +
// kleur-histogram. Idempotent: een al-genormaliseerde cutout blijft ~gelijk.
export async function reprocessCutouts(): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const { id, cutout_path } of listCutoutItems()) {
    const file = await readPhoto('cutout', cutout_path);
    if (!file) {
      failed++;
      continue;
    }
    try {
      const norm = await normalizeCutout(file.data);
      await saveCutout(id, norm); // overschrijft <id>.png
      (await embedFromCutout(id, norm)) ? done++ : failed++;
    } catch {
      failed++;
    }
  }
  return { done, failed };
}

async function loop(): Promise<void> {
  for (;;) {
    let did = false;
    try {
      did = await processOne();
    } catch (e) {
      // claim/db-fout: niet de lus laten sterven
      console.error('[worker] loop-fout:', e);
    }
    await sleep(did ? 50 : IDLE_MS);
  }
}

// Start de in-proces worker exact één keer (HMR-/dubbelstart-veilig via globalThis).
export function startWorker(): void {
  const g = globalThis as { __bciWorkerStarted?: boolean };
  if (g.__bciWorkerStarted) return;
  g.__bciWorkerStarted = true;
  sweepStuckWorking(); // vastgelopen 'working' na een crash terug naar 'processing'
  void loop();
}
