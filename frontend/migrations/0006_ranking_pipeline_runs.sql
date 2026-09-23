CREATE TABLE ranking_pipeline_runs (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('scheduled','manual')),
  frequency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  channels_total INTEGER NOT NULL DEFAULT 0,
  snapshots_written INTEGER NOT NULL DEFAULT 0,
  rankings_published INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL DEFAULT '[]',
  error_summary TEXT NOT NULL DEFAULT ''
);

CREATE INDEX ranking_pipeline_runs_started
  ON ranking_pipeline_runs(started_at DESC, id DESC);
