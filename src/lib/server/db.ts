import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Child, Filterset, Item, ItemFilters, ItemInput } from '$lib/types';
import { runMigrations } from './migrations';
import { sizesMatchingFilter } from '$lib/config';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  size TEXT NOT NULL,
  type TEXT,
  length TEXT,
  season TEXT,
  quality TEXT,
  favorite INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  note TEXT,
  photo_orig TEXT,
  photo_display TEXT,
  ai_status TEXT NOT NULL DEFAULT 'none'
    CHECK (ai_status IN ('none','processing','working','suggested','done','failed')),
  ai_suggestions TEXT,
  cutout_path TEXT,
  cutout_status TEXT NOT NULL DEFAULT 'none'
    CHECK (cutout_status IN ('none','done','failed')),
  cutout_job TEXT,   -- cutout-wachtrij: 'queued:<model>' / 'working:<model>' / NULL (geen CHECK: zie migratie)
  cutout_model TEXT, -- model van de huidige cutout ('birefnet-general' = scherp); NULL = onbekend/niet-scherp
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS child (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  current_size TEXT
);

CREATE TABLE IF NOT EXISTS filterset (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  filter_json TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS outfit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  thumb_path TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outfit_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outfit_id INTEGER NOT NULL REFERENCES outfit(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 1,
  rotation REAL NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_claim ON item(ai_status, created_at);
CREATE INDEX IF NOT EXISTS idx_item_created ON item(created_at);
CREATE INDEX IF NOT EXISTS idx_outfit_item_outfit ON outfit_item(outfit_id);
CREATE INDEX IF NOT EXISTS idx_outfit_item_item ON outfit_item(item_id);
`;

export type DB = Database.Database;

export function createDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON'); // nodig voor ON DELETE CASCADE
  db.exec(SCHEMA); // baseline (idempotent)
  runMigrations(db); // openstaande migraties bovenop de baseline
  return db;
}

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) _db = createDb(process.env.DATABASE_PATH ?? 'data/app.db');
  return _db;
}

export function setDbForTesting(db: DB): void {
  _db = db;
}

// --- item CRUD ---

const ITEM_FIELDS = [
  'size',
  'type',
  'length',
  'season',
  'quality',
  'favorite',
  'color',
  'note',
  'photo_orig',
  'photo_display',
  'ai_status'
] as const;

export function createItem(input: ItemInput): Item {
  const db = getDb();
  const row = {
    size: input.size,
    type: input.type ?? null,
    length: input.length ?? null,
    // season is een lijst (meerdere seizoenen per item) → opgeslagen als JSON-array
    season: input.seasons && input.seasons.length ? JSON.stringify(input.seasons) : null,
    quality: input.quality ?? null,
    favorite: input.favorite ?? 0,
    color: input.color ?? null,
    note: input.note ?? null,
    photo_orig: input.photo_orig ?? null,
    photo_display: input.photo_display ?? null,
    ai_status: input.ai_status ?? 'none',
    created_at: new Date().toISOString()
  };
  const info = db
    .prepare(
      `INSERT INTO item (size,type,length,season,quality,favorite,color,note,photo_orig,photo_display,ai_status,created_at)
       VALUES (@size,@type,@length,@season,@quality,@favorite,@color,@note,@photo_orig,@photo_display,@ai_status,@created_at)`
    )
    .run(row);
  return getItem(Number(info.lastInsertRowid))!;
}

export function getItem(id: number): Item | undefined {
  return getDb().prepare('SELECT * FROM item WHERE id = ?').get(id) as Item | undefined;
}

// Patch een subset velden. ai_suggestions/cutout_* mogen ook mee.
export function updateItem(
  id: number,
  patch: Partial<Item>
): Item | undefined {
  const db = getDb();
  const allowed: (keyof Item)[] = [
    ...ITEM_FIELDS,
    'ai_suggestions',
    'cutout_path',
    'cutout_status',
    'cutout_model'
  ];
  const keys = allowed.filter((k) => k in patch).map((k) => String(k));
  if (keys.length === 0) return getItem(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  const params: Record<string, unknown> = { id };
  for (const k of keys) params[k] = patch[k as keyof Item];
  db.prepare(`UPDATE item SET ${setClause} WHERE id = @id`).run(params);
  return getItem(id);
}

export function deleteItem(id: number): boolean {
  return getDb().prepare('DELETE FROM item WHERE id = ?').run(id).changes > 0;
}

// Eenvoudige key/value-meta (o.a. eenmalige data-taken bij startup).
export function getMeta(key: string): string | undefined {
  return (getDb().prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined)
    ?.value;
}

export function setMeta(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)').run(key, value);
}

const MULTI_FILTERS: { key: keyof ItemFilters; col: string }[] = [
  { key: 'type', col: 'type' },
  { key: 'length', col: 'length' },
  { key: 'quality', col: 'quality' },
  { key: 'color', col: 'color' },
  { key: 'ai_status', col: 'ai_status' }
  // season niet hier: het is een JSON-array → aparte json_each-match (zie queryItems)
];

export function queryItems(filters: ItemFilters = {}): Item[] {
  const where: string[] = [];
  const params: unknown[] = [];

  for (const { key, col } of MULTI_FILTERS) {
    const vals = filters[key] as string[] | undefined;
    if (vals && vals.length) {
      where.push(`${col} IN (${vals.map(() => '?').join(',')})`);
      params.push(...vals);
    }
  }
  // maat: dubbele maten tellen voor beide componenten → expandeer de gevraagde
  // maten naar alle opgeslagen maat-strings die overlappen (bv. 86 → 86, 86/92).
  if (filters.size && filters.size.length) {
    const wanted = sizesMatchingFilter(filters.size);
    where.push(`size IN (${wanted.map(() => '?').join(',')})`);
    params.push(...wanted);
  }
  // season: item matcht als z'n lijst één van de gevraagde seizoenen bevat, OF
  // 'allseason' (jaar-rond items horen onder elk specifiek seizoen). json_each
  // op een NULL/lege kolom levert geen rijen → zo'n item matcht niet.
  if (filters.season && filters.season.length) {
    const wanted = Array.from(new Set([...filters.season, 'allseason']));
    where.push(
      `EXISTS (SELECT 1 FROM json_each(item.season) WHERE value IN (${wanted.map(() => '?').join(',')}))`
    );
    params.push(...wanted);
  }
  if (filters.favorite) where.push('favorite = 1');
  if (filters.search) {
    where.push('(type LIKE ? OR color LIKE ? OR note LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  const orderBy =
    filters.sort === 'size' ? 'CAST(size AS INTEGER) ASC, created_at DESC' : 'created_at DESC';
  const sql =
    'SELECT * FROM item' +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY ${orderBy}`;
  return getDb().prepare(sql).all(...params) as Item[];
}

// Aggregatie maat × type voor de heatmap.
export function countBySizeType(): { size: string; type: string | null; n: number }[] {
  return getDb()
    .prepare('SELECT size, type, COUNT(*) AS n FROM item GROUP BY size, type')
    .all() as { size: string; type: string | null; n: number }[];
}

// Aggregatie maat × type × seizoen-set (rauwe season-JSON) voor de seizoen-matrix.
// Groeperen op de hele JSON-string voorkomt dubbeltelling per item; de client
// parset en expandeert 'allseason'.
export function countBySizeTypeSeason(): {
  size: string;
  type: string | null;
  season: string | null;
  n: number;
}[] {
  return getDb()
    .prepare('SELECT size, type, season, COUNT(*) AS n FROM item GROUP BY size, type, season')
    .all() as { size: string; type: string | null; season: string | null; n: number }[];
}

// --- worker-claim ---

// Atomair één processing-item naar 'working' tillen (voorkomt dubbel oppakken).
export function claimNextProcessing(): Item | undefined {
  return getDb()
    .prepare(
      `UPDATE item SET ai_status='working'
       WHERE id = (SELECT id FROM item WHERE ai_status='processing' ORDER BY created_at LIMIT 1)
       RETURNING *`
    )
    .get() as Item | undefined;
}

// Bij opstart: vastgelopen 'working' terug naar de wachtrij (AI én cutout).
export function sweepStuckWorking(): number {
  const db = getDb();
  const ai = db.prepare("UPDATE item SET ai_status='processing' WHERE ai_status='working'").run().changes;
  const cut = db
    .prepare("UPDATE item SET cutout_job = 'queued:' || substr(cutout_job, 9) WHERE cutout_job LIKE 'working:%'")
    .run().changes;
  return ai + cut;
}

// --- cutout-wachtrij (cutout_job: 'queued:<model>' / 'working:<model>' / NULL) ---

// Zet een (re)cutout-job in de wachtrij. model leeg → sidecar-default (isnet).
export function enqueueCutout(id: number, model?: string): void {
  getDb()
    .prepare("UPDATE item SET cutout_job = 'queued:' || ? WHERE id = ?")
    .run(model ?? '', id);
}

// Alle items met display-foto in de cutout-wachtrij (bv. eenmalige her-generatie).
export function enqueueAllCutouts(model?: string): number {
  return getDb()
    .prepare("UPDATE item SET cutout_job = 'queued:' || ? WHERE photo_display IS NOT NULL")
    .run(model ?? '').changes;
}

// 'Scherp' = birefnet-general. NULL/isnet telt als niet-scherp.
const SHARP_MODEL = 'birefnet-general';

// Aantal items-met-foto waarvan de huidige cutout nog niet scherp is.
export function countNotSharp(): number {
  return (
    getDb()
      .prepare(
        `SELECT count(*) AS n FROM item
         WHERE photo_display IS NOT NULL AND (cutout_model IS NULL OR cutout_model <> ?)`
      )
      .get(SHARP_MODEL) as { n: number }
  ).n;
}

// Aantal items met een lopende/wachtende cutout-job.
export function countQueuedCutouts(): number {
  return (
    getDb().prepare('SELECT count(*) AS n FROM item WHERE cutout_job IS NOT NULL').get() as { n: number }
  ).n;
}

// Zet alle nog-niet-scherpe items (zonder lopende job) in de birefnet-queue. Retourneert count.
export function enqueueSharpenAll(): number {
  return getDb()
    .prepare(
      `UPDATE item SET cutout_job = 'queued:' || ?
       WHERE photo_display IS NOT NULL AND cutout_job IS NULL
         AND (cutout_model IS NULL OR cutout_model <> ?)`
    )
    .run(SHARP_MODEL, SHARP_MODEL).changes;
}

// Atomair de oudste queued-job naar 'working' tillen. Retourneert id + model (leeg = default).
export function claimNextCutout(): { id: number; model: string } | undefined {
  const row = getDb()
    .prepare(
      `UPDATE item SET cutout_job = 'working:' || substr(cutout_job, 8)
       WHERE id = (SELECT id FROM item WHERE cutout_job LIKE 'queued:%' ORDER BY created_at LIMIT 1)
       RETURNING id, substr(cutout_job, 9) AS model`
    )
    .get() as { id: number; model: string } | undefined;
  return row;
}

// Job afronden: uit de wachtrij halen (cutout_status is al door generateCutout gezet).
export function clearCutoutJob(id: number): void {
  getDb().prepare('UPDATE item SET cutout_job = NULL WHERE id = ?').run(id);
}

// Worker schrijft z'n resultaat ALLEEN als 't item nog 'working' is. Heeft de
// gebruiker 't ondertussen handmatig afgehandeld (done) of verwijderd, dan is de
// update een no-op → geen overschrijven van handwerk. Retourneert of 't toesloeg.
export function finishTagging(id: number, suggestionsJson: string): boolean {
  return (
    getDb()
      .prepare(
        "UPDATE item SET ai_suggestions = ?, ai_status = 'suggested' WHERE id = ? AND ai_status = 'working'"
      )
      .run(suggestionsJson, id).changes > 0
  );
}

export function failTagging(id: number): boolean {
  return (
    getDb()
      .prepare("UPDATE item SET ai_status = 'failed' WHERE id = ? AND ai_status = 'working'")
      .run(id).changes > 0
  );
}

// --- filterset CRUD ---

export function listFiltersets(): Filterset[] {
  return getDb()
    .prepare('SELECT * FROM filterset ORDER BY pinned DESC, name ASC')
    .all() as Filterset[];
}

export function createFilterset(name: string, filterJson: string, pinned = 0): Filterset {
  const info = getDb()
    .prepare('INSERT INTO filterset (name, filter_json, pinned) VALUES (?, ?, ?)')
    .run(name, filterJson, pinned);
  return getDb()
    .prepare('SELECT * FROM filterset WHERE id = ?')
    .get(Number(info.lastInsertRowid)) as Filterset;
}

export function updateFilterset(
  id: number,
  patch: Partial<Pick<Filterset, 'name' | 'filter_json' | 'pinned'>>
): Filterset | undefined {
  const keys = (['name', 'filter_json', 'pinned'] as const).filter((k) => k in patch);
  if (keys.length) {
    const set = keys.map((k) => `${k} = @${k}`).join(', ');
    const params: Record<string, unknown> = { id };
    for (const k of keys) params[k] = patch[k];
    getDb().prepare(`UPDATE filterset SET ${set} WHERE id = @id`).run(params);
  }
  return getDb().prepare('SELECT * FROM filterset WHERE id = ?').get(id) as Filterset | undefined;
}

export function deleteFilterset(id: number): boolean {
  return getDb().prepare('DELETE FROM filterset WHERE id = ?').run(id).changes > 0;
}

// --- child CRUD ---

type ChildRow = { id: number; name: string; current_size: string | null };

// current_size-kolom bevat een JSON-array; kale strings (pre-migratie) → 1 maat.
function rowToChild(r: ChildRow): Child {
  let sizes: string[] = [];
  if (r.current_size) {
    try {
      const v = JSON.parse(r.current_size);
      sizes = Array.isArray(v) ? v.map(String) : [String(v)];
    } catch {
      sizes = [r.current_size];
    }
  }
  return { id: r.id, name: r.name, current_sizes: sizes };
}

export function listChildren(): Child[] {
  return (getDb().prepare('SELECT * FROM child ORDER BY id ASC').all() as ChildRow[]).map(rowToChild);
}

function getChild(id: number): Child | undefined {
  const row = getDb().prepare('SELECT * FROM child WHERE id = ?').get(id) as ChildRow | undefined;
  return row ? rowToChild(row) : undefined;
}

export function createChild(name: string, currentSizes: string[] = []): Child {
  const info = getDb()
    .prepare('INSERT INTO child (name, current_size) VALUES (?, ?)')
    .run(name, JSON.stringify(currentSizes));
  return getChild(Number(info.lastInsertRowid)) as Child;
}

export function updateChild(
  id: number,
  patch: { name?: string; current_sizes?: string[] }
): Child | undefined {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if (patch.name !== undefined) {
    sets.push('name = @name');
    params.name = patch.name;
  }
  if (patch.current_sizes !== undefined) {
    sets.push('current_size = @current_size');
    params.current_size = JSON.stringify(patch.current_sizes);
  }
  if (sets.length) {
    getDb().prepare(`UPDATE child SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }
  return getChild(id);
}

export function deleteChild(id: number): boolean {
  return getDb().prepare('DELETE FROM child WHERE id = ?').run(id).changes > 0;
}
