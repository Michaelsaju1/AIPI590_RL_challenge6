-- Supabase table schema for the Human Preference Collector
-- Run this in the Supabase SQL Editor to set up your database.

CREATE TABLE IF NOT EXISTS preferences (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    prompt          TEXT NOT NULL,
    chosen          TEXT NOT NULL,
    rejected        TEXT NOT NULL,
    preference      TEXT NOT NULL CHECK (preference IN ('A', 'B', 'tie')),
    is_tie          BOOLEAN NOT NULL DEFAULT FALSE,
    prompt_category TEXT,
    prompt_id       TEXT,
    prompt_tags     JSONB,
    chosen_metadata JSONB,
    rejected_metadata JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by prompt category or ID
CREATE INDEX IF NOT EXISTS idx_preferences_prompt_id ON preferences(prompt_id);
CREATE INDEX IF NOT EXISTS idx_preferences_category ON preferences(prompt_category);

-- Enable Row Level Security (optional, recommended for production)
-- ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow inserts" ON preferences FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow reads" ON preferences FOR SELECT USING (true);
