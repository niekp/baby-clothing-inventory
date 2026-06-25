import {
  claimNextProcessing,
  failTagging,
  finishTagging,
  getItem,
  getMeta,
  listDisplayItems,
  setMeta,
  sweepStuckWorking,
  updateItem
} from './db';
import sharp from 'sharp';
import { normalizeCutout, readPhoto, saveCutout } from './photos';
import { tagImage } from './ai';
import { cutout } from './rembg';

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

// Vlakt een (cutout-)PNG op wit af tot JPEG — invoer voor AI-tagging.
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

// Cutout-pijplijn-versie: ophogen om alle cutouts eenmalig opnieuw te genereren.
// 2 = padding teruggedraaid (gaf vloer-doorslag op lage-contrast foto's).
const CUTOUT_GEN = 2;

// Eenmalige hergeneratie na een pijplijn-wijziging; versie-gated zoals een migratie,
// maar async/op de achtergrond (rembg-calls mogen de boot niet blokkeren).
async function regenCutoutsIfStale(): Promise<void> {
  if (Number(getMeta('cutout_gen') ?? 0) >= CUTOUT_GEN) return;
  const { done, failed } = await regenerateAllCutouts();
  // niet bumpen als álles faalde (sidecar down) → volgende boot probeert opnieuw
  if (done > 0 || done + failed === 0) setMeta('cutout_gen', String(CUTOUT_GEN));
  console.info(`[cutouts] eenmalige hergeneratie (gen ${CUTOUT_GEN}): ${done} ok, ${failed} mislukt`);
}

// Genereert de cutout opnieuw voor alle items met display-foto (rembg + normalisatie,
// mét padding). Géén re-tag: handmatige labels blijven. Serieel; sidecar is concurrency-1.
async function regenerateAllCutouts(): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const { id, photo_display } of listDisplayItems()) {
    const file = await readPhoto('disp', photo_display);
    if (!file) {
      failed++;
      continue;
    }
    (await generateCutout(id, file.data)) ? done++ : failed++;
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
  void regenCutoutsIfStale().catch((e) => console.error('[cutouts] hergeneratie-fout:', e));
  void loop();
}
