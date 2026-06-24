import {
  claimNextProcessing,
  failTagging,
  finishTagging,
  getItem,
  sweepStuckWorking,
  updateItem
} from './db';
import sharp from 'sharp';
import { readPhoto, saveCutout } from './photos';
import { tagImage } from './ollama';
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

  // 1) tagging — schrijf het resultaat alleen weg als 't item nog 'working' is
  // (de gebruiker kan 't ondertussen handmatig hebben afgehandeld → niet overschrijven).
  try {
    // ollama's vision-decoder (llama.cpp mtmd) leest geen WebP → forceer JPEG
    const jpeg = await sharp(Buffer.from(file.data)).jpeg({ quality: 90 }).toBuffer();
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

  // 2) eager cutout in dezelfde pass (onafhankelijk van tagging). ~2s valt in
  // het niet bij de ~2min tagging; niet-fataal als de sidecar faalt. Sla over als
  // 't item ondertussen verwijderd is (geen wees-cutout schrijven).
  if (getItem(item.id)) await generateCutout(item.id, file.data);
  return true;
}

// Maakt de vrijstaande cutout via de rembg-sidecar. Niet-fataal.
export async function generateCutout(id: number, displayBytes: Uint8Array<ArrayBuffer>): Promise<void> {
  try {
    const png = await cutout(displayBytes);
    const name = await saveCutout(id, png);
    updateItem(id, { cutout_path: name, cutout_status: 'done' });
  } catch (e) {
    console.error(`[worker] item ${id} cutout mislukt:`, e);
    try {
      updateItem(id, { cutout_status: 'failed' });
    } catch {
      /* db onbereikbaar */
    }
  }
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
