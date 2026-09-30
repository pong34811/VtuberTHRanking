-- Forward-only query indexes; preserve original timestamps and historical data.
CREATE INDEX IF NOT EXISTS snapshots_chronological_latest
  ON stats_snapshots(vtuber_id, julianday(recorded_at) DESC, id DESC);
CREATE INDEX IF NOT EXISTS snapshots_bangkok_day
  ON stats_snapshots(vtuber_id, date(recorded_at, '+7 hours'), julianday(recorded_at) DESC, id DESC);
CREATE INDEX IF NOT EXISTS rankings_public_lookup
  ON rankings(period, category, month, status, rank, vtuber_id);
CREATE INDEX IF NOT EXISTS pipeline_successful_publication
  ON ranking_pipeline_runs(status, completed_at DESC, id DESC);
