-- Forward-only updater lease. A monotonically increasing fence survives release.
CREATE TABLE ranking_pipeline_lease (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  owner TEXT,
  fence INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO ranking_pipeline_lease(id) VALUES (1);
ALTER TABLE ranking_pipeline_runs ADD COLUMN fence_token INTEGER;
ALTER TABLE ranking_pipeline_runs ADD COLUMN slot_key TEXT;
ALTER TABLE ranking_pipeline_runs ADD COLUMN slot_at TEXT;
ALTER TABLE ranking_pipeline_runs ADD COLUMN target_month TEXT;
ALTER TABLE ranking_pipeline_runs ADD COLUMN rankings_expected INTEGER NOT NULL DEFAULT 6;
CREATE UNIQUE INDEX ranking_pipeline_slot ON ranking_pipeline_runs(slot_key) WHERE slot_key IS NOT NULL;
-- CHECK failures roll back a complete D1 batch if a suspended owner is fenced.
CREATE TABLE ranking_pipeline_assertions (valid INTEGER NOT NULL CHECK (valid = 1));
ALTER TABLE ranking_pipeline_runs ADD COLUMN stage_ready INTEGER NOT NULL DEFAULT 0 CHECK (stage_ready IN (0,1));
ALTER TABLE ranking_pipeline_runs ADD COLUMN observed_at TEXT;
ALTER TABLE ranking_pipeline_runs ADD COLUMN metrics_json TEXT NOT NULL DEFAULT '["followers","views","videos"]';
ALTER TABLE ranking_pipeline_runs ADD COLUMN collection_due INTEGER NOT NULL DEFAULT 1 CHECK (collection_due IN (0,1));
ALTER TABLE ranking_pipeline_runs ADD COLUMN archives_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE stats_snapshots ADD COLUMN pipeline_run_id TEXT REFERENCES ranking_pipeline_runs(id);
ALTER TABLE stats_snapshots ADD COLUMN collection_slot TEXT;
CREATE UNIQUE INDEX snapshot_collection_slot ON stats_snapshots(vtuber_id,collection_slot) WHERE collection_slot IS NOT NULL;
-- Private checkpoint rows never appear in public snapshot APIs before commit.
CREATE TABLE ranking_pipeline_snapshots (
  run_id TEXT NOT NULL REFERENCES ranking_pipeline_runs(id) ON DELETE CASCADE,
  vtuber_id INTEGER NOT NULL REFERENCES vtubers(id) ON DELETE CASCADE,
  followers INTEGER NOT NULL CHECK (followers >= 0),
  total_views INTEGER NOT NULL CHECK (total_views >= 0),
  video_count INTEGER NOT NULL CHECK (video_count >= 0),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (run_id,vtuber_id)
);
CREATE TABLE ranking_publications (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES ranking_pipeline_runs(id),
  target_month TEXT NOT NULL,
  published_at TEXT NOT NULL,
  rankings_expected INTEGER NOT NULL
);
-- An immutable journal accompanies the backwards-compatible materialized table.
CREATE TABLE ranking_publication_rows (
  publication_id TEXT NOT NULL REFERENCES ranking_publications(id),
  vtuber_id INTEGER NOT NULL REFERENCES vtubers(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('monthly','alltime')),
  category TEXT NOT NULL CHECK (category IN ('followers','views','videos')),
  month TEXT,
  rank INTEGER NOT NULL, score INTEGER NOT NULL, rank_change INTEGER,
  subscriber_count INTEGER NOT NULL, total_views INTEGER NOT NULL, video_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', calculated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ranking_publication_set ON ranking_publication_rows(publication_id,period,category,COALESCE(month,''),vtuber_id);
CREATE TABLE ranking_month_finalizations (
  month TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES ranking_publications(id),
  finalized_at TEXT NOT NULL
);
