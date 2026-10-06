ALTER TABLE directory_candidates ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(profile_json));
ALTER TABLE directory_candidates ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json));
ALTER TABLE directory_candidates ADD COLUMN review_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(review_json));
CREATE TABLE directory_search_checkpoint (
  id INTEGER PRIMARY KEY CHECK (id=1),
  day TEXT NOT NULL,
  query_index INTEGER NOT NULL DEFAULT 0,
  page_token TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(items_json)),
  next_page_token TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0,1))
);
ALTER TABLE directory_sync_runs ADD COLUMN candidates_checked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE directory_sync_runs ADD COLUMN candidates_new INTEGER NOT NULL DEFAULT 0;
ALTER TABLE directory_sync_runs ADD COLUMN candidates_duplicate INTEGER NOT NULL DEFAULT 0;
ALTER TABLE directory_sync_runs ADD COLUMN candidates_unavailable INTEGER NOT NULL DEFAULT 0;
CREATE TABLE directory_candidate_assertions (
  valid INTEGER NOT NULL CONSTRAINT directory_candidate_stale CHECK (valid=1)
);
