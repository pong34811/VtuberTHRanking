-- Baseline is safe for the already-deployed database and creates clean local databases.
CREATE TABLE IF NOT EXISTS vtubers (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
 bio TEXT DEFAULT '', avatar TEXT DEFAULT '', channel_url TEXT NOT NULL,
 platform TEXT DEFAULT 'youtube' CHECK(platform IN ('youtube','twitch','bilibili','other')),
 category TEXT DEFAULT 'other' CHECK(category IN ('gaming','singing','chatting','art','asmr','education','other')),
 affiliation TEXT DEFAULT 'indie' CHECK(affiliation IN ('indie','agency')), agency_name TEXT DEFAULT '',
 is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS stats_snapshots (
 id INTEGER PRIMARY KEY AUTOINCREMENT, vtuber_id INTEGER NOT NULL,
 followers INTEGER DEFAULT 0, total_views INTEGER DEFAULT 0, avg_views INTEGER DEFAULT 0,
 recorded_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS rankings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, vtuber_id INTEGER NOT NULL,
 period TEXT NOT NULL CHECK(period IN ('monthly','alltime')),
 category TEXT NOT NULL CHECK(category IN ('followers','views')), rank INTEGER NOT NULL,
 score INTEGER NOT NULL, rank_change INTEGER DEFAULT 0, month TEXT,
 calculated_at TEXT DEFAULT (datetime('now')), FOREIGN KEY(vtuber_id) REFERENCES vtubers(id) ON DELETE CASCADE,
 UNIQUE(period,category,month,vtuber_id)
);
