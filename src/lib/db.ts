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
		reading_time_s REAL,
		user_ip        TEXT,
		temp_a         REAL,
		temp_b         REAL,
		scrolled_a     INTEGER,
		scrolled_b     INTEGER,
		created_at      TEXT NOT NULL DEFAULT (datetime('now'))
	)
`);

// Add columns if they don't exist (migration for existing databases)
try { db.exec(`ALTER TABLE preferences ADD COLUMN reading_time_s REAL`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE preferences ADD COLUMN user_ip TEXT`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE preferences ADD COLUMN temp_a REAL`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE preferences ADD COLUMN temp_b REAL`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE preferences ADD COLUMN scrolled_a INTEGER`); } catch { /* exists */ }
try { db.exec(`ALTER TABLE preferences ADD COLUMN scrolled_b INTEGER`); } catch { /* exists */ }

db.exec(`CREATE INDEX IF NOT EXISTS idx_preferences_prompt_id ON preferences(prompt_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(prompt_category)`);

export default db;

export const insertPreference = db.prepare(`
	INSERT INTO preferences (timestamp, prompt, chosen, rejected, preference, is_tie, prompt_category, prompt_id, prompt_tags, chosen_metadata, rejected_metadata, reading_time_s, user_ip, temp_a, temp_b, scrolled_a, scrolled_b)
	VALUES (@timestamp, @prompt, @chosen, @rejected, @preference, @is_tie, @prompt_category, @prompt_id, @prompt_tags, @chosen_metadata, @rejected_metadata, @reading_time_s, @user_ip, @temp_a, @temp_b, @scrolled_a, @scrolled_b)
`);
