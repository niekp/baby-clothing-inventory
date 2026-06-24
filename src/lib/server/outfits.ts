import { getDb } from './db';
import type { Item, Outfit, OutfitItem } from '$lib/types';

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

export function listOutfits(): Outfit[] {
  return getDb().prepare('SELECT * FROM outfit ORDER BY created_at DESC').all() as Outfit[];
}

export function getOutfit(id: number): Outfit | undefined {
  return getDb().prepare('SELECT * FROM outfit WHERE id = ?').get(id) as Outfit | undefined;
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

export function createOutfit(name: string, items: OutfitItemInput[]): Outfit {
  const db = getDb();
  const tx = db.transaction((n: string, its: OutfitItemInput[]) => {
    const info = db
      .prepare('INSERT INTO outfit (name, created_at) VALUES (?, ?)')
      .run(n, new Date().toISOString());
    const id = Number(info.lastInsertRowid);
    replaceItems(id, its);
    return id;
  });
  return getOutfit(tx(name, items))!;
}

export function updateOutfit(
  id: number,
  patch: { name?: string; items?: OutfitItemInput[] }
): Outfit | undefined {
  const db = getDb();
  if (!getOutfit(id)) return undefined;
  const tx = db.transaction(() => {
    if (patch.name !== undefined) {
      db.prepare('UPDATE outfit SET name = ? WHERE id = ?').run(patch.name, id);
    }
    if (patch.items !== undefined) replaceItems(id, patch.items);
  });
  tx();
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
  return getDb().prepare('DELETE FROM outfit WHERE id = ?').run(id).changes > 0;
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
}
