import { getDb } from './db';
import { broadcast } from './events';
import { sizesMatchingFilter, SIZE_CHIPS } from '$lib/config';
import type { Item, Outfit, OutfitItem, OutfitKind } from '$lib/types';

export interface OutfitItemInput {
  item_id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
}

export interface OutfitItemWithItem extends OutfitItem {
  item: Item;
}

export interface OutfitWithItems {
  outfit: Outfit;
  items: OutfitItemWithItem[];
}

// Optioneel maat-filter: outfits waarvan de maat overlapt met een gevraagde maat
// (86 matcht ook 86/92, via sizesMatchingFilter — consistent met de kast). Outfits
// zonder maat vallen buiten een actief filter. Inspiratie hoort hier niet bij.
export function listOutfits(sizes?: string[]): Outfit[] {
  if (sizes && sizes.length) {
    const wanted = sizesMatchingFilter(sizes);
    if (!wanted.length) return [];
    const placeholders = wanted.map(() => '?').join(',');
    return getDb()
      .prepare(
        `SELECT * FROM outfit WHERE kind = 'own' AND size IN (${placeholders})
         ORDER BY created_at DESC`
      )
      .all(...wanted) as Outfit[];
  }
  return getDb()
    .prepare("SELECT * FROM outfit WHERE kind = 'own' ORDER BY created_at DESC")
    .all() as Outfit[];
}

// Inspiratie-printscreens, nieuwste eerst. Secundair op id: een bulk-upload levert
// meerdere rijen met dezelfde created_at op.
export function listInspiration(): Outfit[] {
  return getDb()
    .prepare("SELECT * FROM outfit WHERE kind = 'inspiration' ORDER BY created_at DESC, id DESC")
    .all() as Outfit[];
}

export function getOutfit(id: number): Outfit | undefined {
  return getDb().prepare('SELECT * FROM outfit WHERE id = ?').get(id) as Outfit | undefined;
}

// Distinct maten die op outfits voorkomen (voor de filterbalk), in SIZE_CHIPS-volgorde.
export function listOutfitSizes(): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT size FROM outfit WHERE kind = 'own' AND size IS NOT NULL")
    .all() as { size: string }[];
  const present = new Set(rows.map((r) => r.size));
  return SIZE_CHIPS.filter((s) => present.has(s));
}

function replaceItems(outfitId: number, items: OutfitItemInput[]): void {
  const db = getDb();
  db.prepare('DELETE FROM outfit_item WHERE outfit_id = ?').run(outfitId);
  const stmt = db.prepare(
    `INSERT INTO outfit_item (outfit_id, item_id, x, y, scale, rotation, z_index)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const it of items) {
    stmt.run(outfitId, it.item_id, it.x, it.y, it.scale, it.rotation, it.z_index);
  }
}

// Inspiratie-printscreen: geen naam, geen maat, geen items. photo_orig volgt zodra het
// bestand met dit id is weggeschreven.
export function createInspiration(note: string | null = null): Outfit {
  const info = getDb()
    .prepare(
      `INSERT INTO outfit (kind, name, note, created_at)
       VALUES ('inspiration', '', @note, @created_at)`
    )
    .run({ note, created_at: new Date().toISOString() });
  broadcast();
  return getOutfit(Number(info.lastInsertRowid))!;
}

export function createOutfit(
  name: string,
  items: OutfitItemInput[],
  size: string | null = null
): Outfit {
  const db = getDb();
  const tx = db.transaction((n: string, its: OutfitItemInput[]) => {
    const info = db
      .prepare('INSERT INTO outfit (name, size, created_at) VALUES (?, ?, ?)')
      .run(n, size, new Date().toISOString());
    const id = Number(info.lastInsertRowid);
    replaceItems(id, its);
    return id;
  });
  const outfit = getOutfit(tx(name, items))!;
  broadcast();
  return outfit;
}

// Velden die alleen bij één soort horen. Een patch die de verkeerde kant op wil, is een
// bug in de caller — vandaar een exception in plaats van stil negeren.
const OWN_ONLY = ['name', 'size', 'items'] as const;
const INSPIRATION_ONLY = ['note', 'favorite'] as const;

export class WrongOutfitKindError extends Error {
  name = 'WrongOutfitKindError';
}

export interface OutfitPatch {
  name?: string;
  items?: OutfitItemInput[];
  size?: string | null;
  note?: string | null;
  favorite?: number;
}

function assertPatchMatchesKind(kind: OutfitKind, patch: OutfitPatch): void {
  const forbidden = kind === 'own' ? INSPIRATION_ONLY : OWN_ONLY;
  const offending = forbidden.filter((field) => patch[field] !== undefined);
  if (offending.length) {
    throw new WrongOutfitKindError(`${offending.join(', ')} hoort niet bij soort ${kind}`);
  }
}

export function updateOutfit(id: number, patch: OutfitPatch): Outfit | undefined {
  const db = getDb();
  const existing = getOutfit(id);
  if (!existing) return undefined;
  assertPatchMatchesKind(existing.kind, patch);
  const tx = db.transaction(() => {
    if (patch.name !== undefined) {
      db.prepare('UPDATE outfit SET name = ? WHERE id = ?').run(patch.name, id);
    }
    if (patch.size !== undefined) {
      db.prepare('UPDATE outfit SET size = ? WHERE id = ?').run(patch.size, id);
    }
    if (patch.note !== undefined) {
      db.prepare('UPDATE outfit SET note = ? WHERE id = ?').run(patch.note, id);
    }
    if (patch.favorite !== undefined) {
      db.prepare('UPDATE outfit SET favorite = ? WHERE id = ?').run(patch.favorite, id);
    }
    if (patch.items !== undefined) replaceItems(id, patch.items);
  });
  tx();
  broadcast();
  return getOutfit(id);
}

export function getOutfitWithItems(id: number): OutfitWithItems | undefined {
  const outfit = getOutfit(id);
  if (!outfit) return undefined;
  const db = getDb();
  const ois = db
    .prepare('SELECT * FROM outfit_item WHERE outfit_id = ? ORDER BY z_index')
    .all(id) as OutfitItem[];
  const itemStmt = db.prepare('SELECT * FROM item WHERE id = ?');
  const items = ois
    .map((oi) => ({ ...oi, item: itemStmt.get(oi.item_id) as Item | undefined }))
    .filter((r): r is OutfitItemWithItem => r.item !== undefined);
  return { outfit, items };
}

export function deleteOutfit(id: number): boolean {
  // outfit_item cascadet via FK ON DELETE CASCADE
  const ok = getDb().prepare('DELETE FROM outfit WHERE id = ?').run(id).changes > 0;
  if (ok) broadcast();
  return ok;
}

// Herkent een FK-schending (bv. een niet-bestaand item_id in de layout) zodat de
// route 'm als 400 i.p.v. 500 kan afhandelen.
export function isForeignKeyError(e: unknown): boolean {
  return (
    !!e && typeof e === 'object' && (e as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY'
  );
}

export function setOutfitThumb(id: number, thumbPath: string): void {
  getDb().prepare('UPDATE outfit SET thumb_path = ? WHERE id = ?').run(thumbPath, id);
  broadcast();
}

// Markeert een outfit als foto-outfit door de bronfoto-bestandsnaam te zetten.
export function setOutfitPhotoOrig(id: number, photoOrig: string): void {
  getDb().prepare('UPDATE outfit SET photo_orig = ? WHERE id = ?').run(photoOrig, id);
  broadcast();
}
