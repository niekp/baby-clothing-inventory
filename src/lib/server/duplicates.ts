// Publieke dubbel-API. De paren worden incrementeel onderhouden in db.ts
// (zie setEmbedding/recomputePairsFor); hier alleen de lees-kant.
export { listDuplicatePairs as findDuplicatePairs, duplicateCount, type DuplicatePair } from './db';
