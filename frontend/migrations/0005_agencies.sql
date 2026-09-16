CREATE TABLE agencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  youtube_channel_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE vtubers ADD COLUMN agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT;
INSERT OR IGNORE INTO agencies (name)
SELECT DISTINCT trim(agency_name) FROM vtubers
WHERE affiliation = 'agency' AND trim(agency_name) <> '';
UPDATE vtubers SET agency_id = (
  SELECT id FROM agencies WHERE agencies.name = trim(vtubers.agency_name)
) WHERE affiliation = 'agency' AND trim(agency_name) <> '';
CREATE INDEX vtubers_agency_id ON vtubers(agency_id);
