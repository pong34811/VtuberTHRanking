PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE categories_new (
  id TEXT PRIMARY KEY CHECK(id IN ('followers','views','videos')),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive'))
);
INSERT INTO categories_new SELECT * FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
INSERT INTO categories(id,name,slug,description,sort_order) VALUES
 ('videos','จำนวนคลิป','videos','จัดอันดับจากจำนวนคลิปวิดีโอ',3);
CREATE TABLE rankings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vtuber_id INTEGER NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('monthly','alltime')),
  category TEXT NOT NULL CHECK(category IN ('followers','views','videos')),
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  rank_change INTEGER DEFAULT 0,
  month TEXT,
  calculated_at TEXT DEFAULT (datetime('now')),
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  total_views INTEGER NOT NULL DEFAULT 0,
  video_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  FOREIGN KEY (vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
  UNIQUE(period,category,month,vtuber_id)
);
INSERT INTO rankings_new SELECT * FROM rankings;
DROP TABLE rankings;
ALTER TABLE rankings_new RENAME TO rankings;
CREATE UNIQUE INDEX rankings_alltime_unique ON rankings(period,category,vtuber_id) WHERE month IS NULL;
CREATE INDEX snapshots_latest ON stats_snapshots(vtuber_id,recorded_at DESC,id DESC);
COMMIT;
PRAGMA foreign_keys=ON;
