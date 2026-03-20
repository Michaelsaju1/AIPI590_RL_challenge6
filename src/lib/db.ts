import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'preferences.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create the preferences table if it doesn't exist
db.exec(`
	CREATE TABLE IF NOT EXISTS preferences (
		id              INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp       TEXT NOT NULL,
		prompt          TEXT NOT NULL,
		chosen          TEXT NOT NULL,
		rejected        TEXT NOT NULL,
		preference      TEXT NOT NULL CHECK (preference IN ('A', 'B', 'tie')),
		is_tie          INTEGER NOT NULL DEFAULT 0,
		prompt_category TEXT,
		prompt_id       TEXT,
		prompt_tags     TEXT,
		chosen_metadata TEXT,
		rejected_metadata TEXT,
		created_at      TEXT NOT NULL DEFAULT (datetime('now'))
	)
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_preferences_prompt_id ON preferences(prompt_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(prompt_category)`);

export const insertPreference = db.prepare(`
	INSERT INTO preferences (timestamp, prompt, chosen, rejected, preference, is_tie, prompt_category, prompt_id, prompt_tags, chosen_metadata, rejected_metadata)
	VALUES (@timestamp, @prompt, @chosen, @rejected, @preference, @is_tie, @prompt_category, @prompt_id, @prompt_tags, @chosen_metadata, @rejected_metadata)
`);

export default db;
