import {
  claimNextProcessing,
  failTagging,
  finishTagging,
  getItem,
  itemsMissingEmbedding,
  setEmbedding,
  sweepStuckWorking,
  updateItem
} from './db';
import sharp from 'sharp';
import { readPhoto, saveCutout } from './photos';
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

  // 1) cutout eerst (~2s): een vrijstaand kledingstuk zonder achtergrond-ruis is
  // veel duidelijker voor de AI dan een portretfoto met kamer eromheen.
  const cut = await generateCutout(item.id, file.data);

  // 2) tagging op de cutout (op wit geflatten); val terug op de displayfoto als
  //    de cutout faalde. Resultaat alleen wegschrijven als 't item nog 'working'
  //    is (de gebruiker kan 't ondertussen handmatig hebben afgehandeld).
  try {
    // ollama's vision-decoder (llama.cpp mtmd) leest geen WebP en geen alpha →
    // flatten op wit + JPEG. Cutout op wit = schone "product"-foto.
    const jpeg = await sharp(Buffer.from(cut ?? file.data))
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
    // embedding + kleur-histogram (dubbel-detectie); niet-fataal voor tagging
    await embedItem(item.id, jpeg, cut);
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

// Maakt de vrijstaande cutout via de rembg-sidecar. Niet-fataal. Retourneert de
// PNG-bytes (voor hergebruik bij tagging) of null bij fout/verwijderd item.
export async function generateCutout(
  id: number,
  displayBytes: Uint8Array<ArrayBuffer>
): Promise<Uint8Array | null> {
  try {
    const png = await cutout(displayBytes);
    if (!getItem(id)) return null; // item ondertussen verwijderd → geen wees-cutout
    const name = await saveCutout(id, png);
    updateItem(id, { cutout_path: name, cutout_status: 'done' });
    return png;
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

// Berekent + bewaart de CLIP-embedding van een item. Niet-fataal: een fout hier
// mag de tagging niet breken (vandaar eigen try/catch i.p.v. doorgooien).
// cutPng: de cutout-PNG (met alpha) voor het kleur-histogram; null → geen histogram
// (item telt dan niet mee in de dubbel-detectie).
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
      const jpeg = await sharp(Buffer.from(file.data))
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 90 })
        .toBuffer();
      // embedding op de afgevlakte foto, kleur-histogram op de cutout (met alpha)
      (await embedItem(id, jpeg, file.data)) ? done++ : failed++;
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
