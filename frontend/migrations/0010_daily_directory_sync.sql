-- Source values are separate from editorial fields; never guess their ownership.
CREATE TABLE youtube_profile_state (
  vtuber_id INTEGER PRIMARY KEY REFERENCES vtubers(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
  reference_json TEXT NOT NULL CHECK (json_valid(reference_json)),
  source_url TEXT NOT NULL,
  checked_at TEXT NOT NULL
);
CREATE INDEX youtube_profile_channel ON youtube_profile_state(channel_id);
CREATE TABLE directory_candidates (
  channel_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  reference_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','imported','ignored')),
  vtuber_id INTEGER REFERENCES vtubers(id) ON DELETE SET NULL,
  checked_at TEXT NOT NULL
);
-- Imported tombstones survive deletion so discovery cannot silently recreate a channel.
CREATE TABLE directory_sync_lease (
  id INTEGER PRIMARY KEY CHECK (id=1),
  owner TEXT,
  fence INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO directory_sync_lease(id) VALUES (1);
CREATE TABLE directory_sync_runs (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  profiles_checked INTEGER NOT NULL DEFAULT 0,
  channels_added INTEGER NOT NULL DEFAULT 0,
  candidates_pending INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT NOT NULL DEFAULT ''
);
INSERT INTO settings(setting_key,setting_value,description) VALUES
  ('directory_sync_enabled','false','ค้นหาและรีเฟรชโปรไฟล์ YouTube วันละครั้ง');
