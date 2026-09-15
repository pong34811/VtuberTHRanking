ALTER TABLE vtubers ADD COLUMN country TEXT NOT NULL DEFAULT 'Thailand';
ALTER TABLE vtubers ADD COLUMN debut_date TEXT NOT NULL DEFAULT '';
ALTER TABLE vtubers ADD COLUMN banner_url TEXT NOT NULL DEFAULT '';
ALTER TABLE vtubers ADD COLUMN youtube_url TEXT NOT NULL DEFAULT '';
ALTER TABLE vtubers ADD COLUMN twitch_url TEXT NOT NULL DEFAULT '';
ALTER TABLE vtubers ADD COLUMN x_url TEXT NOT NULL DEFAULT '';
UPDATE vtubers SET youtube_url=channel_url WHERE platform='youtube';
UPDATE vtubers SET twitch_url=channel_url WHERE platform='twitch';
ALTER TABLE stats_snapshots ADD COLUMN video_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rankings ADD COLUMN subscriber_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rankings ADD COLUMN total_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rankings ADD COLUMN video_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rankings ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive'));
CREATE UNIQUE INDEX rankings_alltime_unique ON rankings(period,category,vtuber_id) WHERE month IS NULL;
CREATE INDEX IF NOT EXISTS snapshots_latest ON stats_snapshots(vtuber_id,recorded_at DESC,id DESC);
CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL COLLATE NOCASE, password_hash TEXT NOT NULL,
 display_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('manager','staff')), status TEXT NOT NULL CHECK(status IN ('active','inactive')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), last_login_at TEXT
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL);
CREATE TABLE bootstrap_lock (id INTEGER PRIMARY KEY CHECK(id=1));
CREATE TABLE categories (
 id TEXT PRIMARY KEY CHECK(id IN ('followers','views')), name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
 description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive'))
);
INSERT INTO categories(id,name,slug,description,sort_order) VALUES
 ('followers','ผู้ติดตาม','followers','จัดอันดับจากจำนวนผู้ติดตาม',1),
 ('views','ยอดวิว','views','จัดอันดับจากยอดวิวรวม',2);
CREATE TABLE reports (
 id TEXT PRIMARY KEY, report_type TEXT NOT NULL, report_period TEXT NOT NULL,
 category_id TEXT NOT NULL REFERENCES categories(id), total_vtubers INTEGER NOT NULL,
 generated_at TEXT NOT NULL DEFAULT (datetime('now')), generated_by TEXT NOT NULL REFERENCES users(id),
 snapshot_json TEXT NOT NULL
);
CREATE TABLE audit_logs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 target_type TEXT NOT NULL,target_id TEXT NOT NULL,details TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX audit_logs_time ON audit_logs(created_at DESC);
CREATE TABLE settings (
 setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO settings(setting_key,setting_value,description) VALUES
 ('site_name','VTuberThai Ranking','ชื่อเว็บไซต์'),
 ('site_status','active','active หรือ maintenance'),
 ('current_ranking_period',strftime('%Y-%m','now','+7 hours'),'รอบอันดับปัจจุบัน'),
 ('ranking_update_frequency','manual','ความถี่ที่ตั้งใจอัปเดต ไม่มีตัวตั้งเวลาอัตโนมัติ');
