import type Database from 'better-sqlite3';

type Migration = { name: string; up: (db: Database.Database) => void };

// Voegt een kolom toe als die nog niet bestaat (guarded ALTER, idempotent).
function addColumnIfMissing(db: Database.Database, table: string, col: string, type: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === col)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`).run();
  }
}

// Geordende migraties bovenop de baseline (CREATE TABLE IF NOT EXISTS in db.ts).
// PRAGMA user_version houdt bij hoeveel er gedraaid zijn. Elke migratie draait
// precies één keer, in een transactie. Conventie: nieuwe kolommen via een
// guarded ALTER hier (niet in de baseline) zodat fresh + bestaande DB's matchen;
// data-transformaties (zoals hieronder) net zo.
export const MIGRATIONS: Migration[] = [
  {
    // season ging van één waarde ('zomer') naar een lijst (JSON-array). Zet
    // bestaande kale-string-waarden om naar een JSON-array. No-op op fresh DB's
    // (daar staat season al als JSON of NULL).
    name: 'season-to-json-array',
    up: (db) => {
      db.prepare(
        `UPDATE item SET season = json_array(season)
         WHERE season IS NOT NULL AND substr(season, 1, 1) <> '['`
      ).run();
    }
  },
  {
    // type-optie 'shirt/top' hernoemd naar 'shirt'. Zet bestaande items + de
    // AI-suggestie-JSON om.
    name: 'rename-shirt-top',
    up: (db) => {
      db.prepare(`UPDATE item SET type = 'shirt' WHERE type = 'shirt/top'`).run();
      db.prepare(
        `UPDATE item SET ai_suggestions = json_set(ai_suggestions, '$.type', 'shirt')
         WHERE json_valid(ai_suggestions) AND json_extract(ai_suggestions, '$.type') = 'shirt/top'`
      ).run();
    }
  },
  {
    // child.current_size ging van één maat naar een lijst (JSON-array), zodat een
    // kind dat 'tussen maten' zit er meerdere kan hebben. Zet bestaande kale-string
    // waarden om naar een JSON-array (NULL blijft NULL → lege lijst in code).
    name: 'child-size-to-json-array',
    up: (db) => {
      db.prepare(
        `UPDATE child SET current_size = json_array(current_size)
         WHERE current_size IS NOT NULL AND substr(current_size, 1, 1) <> '['`
      ).run();
    }
  },
  {
    // item.embedding: CLIP-vector (BLOB) voor dubbel-detectie. Guarded ALTER zodat
    // fresh DB's (baseline zonder kolom) en bestaande DB's allebei matchen.
    // item.embedding: CLIP-vector (BLOB) voor dubbel-detectie
    name: 'add-item-embedding',
    up: (db) => addColumnIfMissing(db, 'item', 'embedding', 'BLOB')
  },
  {
    // item.color_hist: kleur-histogram (BLOB) voor de kleur-gate
    name: 'add-item-color-hist',
    up: (db) => addColumnIfMissing(db, 'item', 'color_hist', 'BLOB')
  },
  {
    // item.cutout_job: cutout-wachtrij ('queued:<model>'/'working:<model>'/NULL). Geen CHECK
    // (cutout_status-CHECK widen zou een tabel-rebuild vergen). Index hier (niet in SCHEMA:
    // dat draait vóór de migraties → kolom bestaat nog niet op bestaande DB's).
    name: 'add-item-cutout-job',
    up: (db) => {
      addColumnIfMissing(db, 'item', 'cutout_job', 'TEXT');
      db.prepare(
        'CREATE INDEX IF NOT EXISTS idx_item_cutout_job ON item(cutout_job) WHERE cutout_job IS NOT NULL'
      ).run();
    }
  }
];

// Draait openstaande migraties (van user_version tot het einde). Retourneert
// het aantal toegepaste migraties.
export function runMigrations(db: Database.Database): number {
  const current = db.pragma('user_version', { simple: true }) as number;
  let applied = 0;
  for (let i = current; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];
    const tx = db.transaction(() => {
      migration.up(db);
      db.pragma(`user_version = ${i + 1}`); // i is een veilige integer-index
    });
    tx();
    applied++;
  }
  return applied;
}
