import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const db: DatabaseType = new Database(path.join(__dirname, '..', 'pokemon-tcg.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    series TEXT,
    release_date TEXT,
    image_symbol TEXT,
    image_logo TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    card_number TEXT,
    rarity TEXT,
    quantity INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    image_small TEXT,
    variant TEXT DEFAULT 'Normal',
    variants TEXT DEFAULT '{}',
    fully_collected INTEGER DEFAULT 0,
    FOREIGN KEY (set_id) REFERENCES sets(id)
  );
`);

export default db;
