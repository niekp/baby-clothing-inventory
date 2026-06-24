import type Database from 'better-sqlite3';

type Migration = { name: string; up: (db: Database.Database) => void };

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
