CREATE TABLE IF NOT EXISTS triggers (id TEXT PRIMARY KEY, scheduled_at TEXT NOT NULL, sent_at TEXT, http INTEGER, ms INTEGER, error TEXT, run_id INTEGER, run_status TEXT, conclusion TEXT, run_created_at TEXT, run_started_at TEXT, run_updated_at TEXT, checked_at TEXT, result TEXT);
-- 2026-09-24 加欄位（既有表）：ALTER TABLE triggers ADD COLUMN result TEXT;
