import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { MIGRATIONS, runMigrations } from './migrations';

describe('runMigrations', () => {
  it('converts legacy bare-string season to a JSON array, leaves JSON/NULL alone', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE item (id INTEGER PRIMARY KEY AUTOINCREMENT, season TEXT)');
    db.prepare("INSERT INTO item (season) VALUES ('zomer')").run();
    db.prepare(`INSERT INTO item (season) VALUES ('["winter"]')`).run();
    db.prepare('INSERT INTO item (season) VALUES (NULL)').run();
    db.pragma('user_version = 0');

    const applied = runMigrations(db);
    expect(applied).toBe(MIGRATIONS.length);

    const rows = db.prepare('SELECT season FROM item ORDER BY id').all() as { season: string | null }[];
    expect(JSON.parse(rows[0].season!)).toEqual(['zomer']); // bare → array
    expect(JSON.parse(rows[1].season!)).toEqual(['winter']); // al JSON → ongewijzigd
    expect(rows[2].season).toBeNull();

    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
  });

  it('is idempotent — a second run applies nothing', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE item (id INTEGER PRIMARY KEY AUTOINCREMENT, season TEXT)');
    runMigrations(db);
    expect(runMigrations(db)).toBe(0);
  });
});
