import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { MIGRATIONS, runMigrations } from './migrations';

const SCHEMA =
  'CREATE TABLE item (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, season TEXT, ai_suggestions TEXT);' +
  'CREATE TABLE child (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, current_size TEXT)';

describe('runMigrations', () => {
  it('converts legacy bare-string season to a JSON array, leaves JSON/NULL alone', () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);
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

  it("hernoemt type 'shirt/top' naar 'shirt' (item + suggestie-JSON)", () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);
    db.prepare("INSERT INTO item (type, ai_suggestions) VALUES ('shirt/top', '{\"type\":\"shirt/top\",\"color\":\"blauw\"}')").run();
    db.prepare("INSERT INTO item (type, ai_suggestions) VALUES ('broek', NULL)").run();

    runMigrations(db);

    const rows = db.prepare('SELECT type, ai_suggestions FROM item ORDER BY id').all() as {
      type: string;
      ai_suggestions: string | null;
    }[];
    expect(rows[0].type).toBe('shirt');
    expect(JSON.parse(rows[0].ai_suggestions!).type).toBe('shirt');
    expect(rows[1].type).toBe('broek'); // ongemoeid
  });

  it('zet kale-string child.current_size om naar een JSON-array, laat NULL met rust', () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);
    db.prepare("INSERT INTO child (name, current_size) VALUES ('A', '74')").run();
    db.prepare(`INSERT INTO child (name, current_size) VALUES ('B', '["86","92"]')`).run();
    db.prepare("INSERT INTO child (name, current_size) VALUES ('C', NULL)").run();

    runMigrations(db);

    const rows = db.prepare('SELECT current_size FROM child ORDER BY id').all() as {
      current_size: string | null;
    }[];
    expect(JSON.parse(rows[0].current_size!)).toEqual(['74']); // bare → array
    expect(JSON.parse(rows[1].current_size!)).toEqual(['86', '92']); // al JSON → ongewijzigd
    expect(rows[2].current_size).toBeNull();
  });

  it('is idempotent — a second run applies nothing', () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);
    runMigrations(db);
    expect(runMigrations(db)).toBe(0);
  });
});
