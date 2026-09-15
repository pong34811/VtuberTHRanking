import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hashPassword, validatePassword } from './password.js';
import { fail, choice, str, month, selection, nextMonthBoundary, previousMonth, competitionRanks, csvCell, body, channel, channelFields } from './admin-domain.js';

const app = new Hono();
const userFields = 'id,username,display_name,email,role,status,created_at,updated_at,last_login_at';
const stmt = (c, sql, ...values) => c.env.DB.prepare(sql).bind(...values);
const list = async (c, sql, ...values) => c.json(await stmt(c, sql, ...values).all().then(({ results }) => ({ results })));
const manager = c => { if (c.get('user')?.role !== 'manager') fail('Manager access required', 403); };
const numericId = c => { const id = Number(c.req.param('id')); if (!Number.isSafeInteger(id) || id < 1) fail('Invalid ID'); return id; };
const audit = (c, action, target, id, details = {}) => stmt(c, 'INSERT INTO audit_logs (id,user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)', crypto.randomUUID(), c.get('user').id, action, target, String(id), JSON.stringify(details));
const exists = async (c, table, id) => { const row = await stmt(c, `SELECT * FROM ${table} WHERE id=?`, id).first(); if (!row) fail('Record not found', 404); return row; };
app.use('*', async (c, next) => { if (!c.get('user') || c.get('user').status !== 'active') fail('Authentication required', 401); await next(); });
app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
  if (/UNIQUE constraint failed/i.test(error.message)) return c.json({ message: 'A record with this unique value already exists' }, 409);
  console.error('Admin operation failed', error);
  return c.json({ message: 'Unable to complete operation' }, 500);
});

app.get('/vtubers', c => list(c, 'SELECT * FROM vtubers ORDER BY name,id LIMIT 2000'));
app.post('/vtubers', async c => {
  const data = channel(await body(c, channelFields)); const fields = Object.keys(data);
  const result = await c.env.DB.batch([
    stmt(c, `INSERT INTO vtubers (${fields.join(',')},created_at,updated_at) VALUES (${fields.map(() => '?').join(',')},datetime('now'),datetime('now'))`, ...Object.values(data)),
    stmt(c, 'INSERT INTO audit_logs (id,user_id,action,target_type,target_id,details) VALUES (?,?,?, ?,CAST(last_insert_rowid() AS TEXT),?)', crypto.randomUUID(), c.get('user').id, 'create', 'vtuber', JSON.stringify({ slug: data.slug })),
  ]);
  return c.json({ ok: true, id: result[0].meta.last_row_id }, 201);
});
app.put('/vtubers/:id', async c => {
  const id = numericId(c); await exists(c, 'vtubers', id);
  const data = channel(await body(c, channelFields));
  await c.env.DB.batch([stmt(c, `UPDATE vtubers SET ${Object.keys(data).map(key => `${key}=?`).join(',')},updated_at=datetime('now') WHERE id=?`, ...Object.values(data), id), audit(c, 'update', 'vtuber', id, { fields: Object.keys(data) })]);
  return c.json({ ok: true, id });
});
app.get('/vtubers/:id/snapshots', async c => { const id = numericId(c); await exists(c, 'vtubers', id); return list(c, 'SELECT * FROM stats_snapshots WHERE vtuber_id=? ORDER BY julianday(recorded_at) DESC,id DESC LIMIT 500', id); });
app.post('/vtubers/:id/snapshots', async c => {
  const id = numericId(c); await exists(c, 'vtubers', id);
  const data = await body(c, ['followers','total_views','video_count','recorded_at']);
  for (const field of ['followers','total_views','video_count']) if (!Number.isSafeInteger(data[field]) || data[field] < 0) fail(`Invalid ${field}`);
  if (typeof data.recorded_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(data.recorded_at) || !Number.isFinite(Date.parse(data.recorded_at))) fail('recorded_at must be an ISO timestamp with timezone');
  const recorded = new Date(data.recorded_at).toISOString();
  await c.env.DB.batch([stmt(c, 'INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)', id, data.followers, data.total_views, data.video_count, recorded), audit(c, 'snapshot.create', 'vtuber', id, { recorded_at: recorded })]);
  return c.json({ ok: true }, 201);
});

app.get('/categories', c => list(c, "SELECT * FROM categories WHERE id IN ('followers','views','videos') ORDER BY sort_order,id"));
app.put('/categories/:id', async c => {
  manager(c); const id = choice(c.req.param('id'), ['followers','views','videos'], 'category'); await exists(c, 'categories', id);
  const data = await body(c, ['id','name','slug','description','sort_order','status']);
  if (data.id !== undefined && data.id !== id) fail('Category ID cannot change');
  const name = str(data.name, 'name', 100, true); const slug = str(data.slug, 'slug', 100, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail('Invalid slug');
  const description = str(data.description ?? '', 'description', 2000);
  if (!Number.isInteger(data.sort_order) || data.sort_order < 0 || data.sort_order > 1000) fail('Invalid sort_order');
  choice(data.status, ['active','inactive'], 'status');
  await c.env.DB.batch([stmt(c, 'UPDATE categories SET name=?,slug=?,description=?,sort_order=?,status=? WHERE id=?', name, slug, description, data.sort_order, data.status, id), audit(c, 'update', 'category', id)]);
  return c.json({ ok: true, id });
});

const rankingRows = async (c, filter) => (await stmt(c, 'SELECT r.*,v.name,v.slug FROM rankings r JOIN vtubers v ON v.id=r.vtuber_id WHERE r.period=? AND r.category=? AND r.month IS ? ORDER BY r.rank,r.vtuber_id', filter.period, filter.category, filter.month).all()).results;
app.get('/rankings', async c => c.json({ results: await rankingRows(c, selection(c.req.query())) }));
app.post('/rankings/calculate', async c => {
  manager(c); const filter = selection(await body(c, ['period','month','category']));
  const cutoff = filter.period === 'monthly' ? nextMonthBoundary(filter.month) : null;
  const rows = (await stmt(c, `SELECT v.id AS vtuber_id,s.followers,s.total_views,s.video_count FROM vtubers v JOIN stats_snapshots s ON s.id=(SELECT ss.id FROM stats_snapshots ss WHERE ss.vtuber_id=v.id AND (? IS NULL OR julianday(ss.recorded_at)<julianday(?)) ORDER BY julianday(ss.recorded_at) DESC,ss.id DESC LIMIT 1) WHERE v.is_active=1 LIMIT 91`, cutoff, cutoff).all()).results;
  if (rows.length > 90) fail('Ranking publication supports at most 90 channels per batch; no changes were saved', 409);
  const previous = await rankingRows(c, { ...filter, month: filter.period === 'monthly' ? previousMonth(filter.month) : null });
  const ranked = competitionRanks(rows, filter.category, previous);
  await c.env.DB.batch([
    stmt(c, 'DELETE FROM rankings WHERE period=? AND category=? AND month IS ?', filter.period, filter.category, filter.month),
    ...ranked.map(row => stmt(c, "INSERT INTO rankings (vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'active',datetime('now'))", row.vtuber_id, filter.period, filter.category, filter.month, row.rank, row.score, row.rank_change, row.followers, row.total_views, row.video_count)),
    audit(c, 'calculate', 'ranking', `${filter.period}:${filter.month || 'alltime'}:${filter.category}`, { count: ranked.length }),
  ]);
  return c.json({ ok: true });
});
app.get('/reports', c => list(c, 'SELECT id,report_type,report_period,category_id,total_vtubers,generated_at,generated_by FROM reports ORDER BY generated_at DESC,id DESC LIMIT 200'));
app.post('/reports', async c => {
  const filter = selection(await body(c, ['period','month','category'])); const rows = await rankingRows(c, filter);
  if (!rows.length) fail('Calculate this ranking before generating a report', 409);
  const id = crypto.randomUUID();
  await c.env.DB.batch([stmt(c, 'INSERT INTO reports (id,report_type,report_period,category_id,total_vtubers,generated_by,snapshot_json) VALUES (?,?,?,?,?,?,?)', id, filter.period, filter.month?.slice(0,7) || 'alltime', filter.category, rows.length, c.get('user').id, JSON.stringify(rows)), audit(c, 'create', 'report', id, filter)]);
  return c.json({ ok: true, id }, 201);
});
app.get('/reports/:id/download', async c => {
  const report = await exists(c, 'reports', str(c.req.param('id'), 'id', 100, true));
  const rows = JSON.parse(report.snapshot_json); const columns = ['rank','vtuber_id','name','slug','score','rank_change','subscriber_count','total_views','video_count'];
  const csv = '\uFEFF' + [columns, ...rows.map(row => columns.map(key => row[key]))].map(row => row.map(csvCell).join(',')).join('\r\n');
  c.header('Content-Type', 'text/csv; charset=utf-8'); c.header('Content-Disposition', 'attachment; filename="ranking-report.csv"'); return c.body(csv);
});
app.get('/audit-logs', c => { manager(c); return list(c, 'SELECT a.*,u.username FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC,a.id DESC LIMIT 200'); });

const settingsKeys = ['site_name','site_status','current_ranking_period','ranking_update_frequency'];
app.get('/settings', c => list(c, `SELECT * FROM settings WHERE setting_key IN (${settingsKeys.map(() => '?').join(',')}) ORDER BY setting_key`, ...settingsKeys));
app.put('/settings', async c => {
  manager(c); const data = await body(c, settingsKeys);
  data.site_name = str(data.site_name, 'site_name', 100, true);
  choice(data.site_status, ['active','maintenance'], 'site_status'); month(data.current_ranking_period); choice(data.ranking_update_frequency, ['manual','hourly','daily','weekly','monthly'], 'ranking_update_frequency');
  await c.env.DB.batch([...settingsKeys.map(key => stmt(c, "INSERT INTO settings (setting_key,setting_value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at", key, data[key])), audit(c, 'update', 'settings', 'site', data)]);
  return c.json({ ok: true });
});

function userData(data) {
  const displayName = str(data.display_name, 'display_name', 100, true); const email = str(data.email, 'email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email');
  return { display_name: displayName, email, role: choice(data.role, ['manager','staff'], 'role'), status: choice(data.status, ['active','inactive'], 'status') };
}
async function passwordHash(password) { validatePassword(password); return hashPassword(password); }
app.get('/users', c => { manager(c); return list(c, `SELECT ${userFields} FROM users ORDER BY username`); });
app.post('/users', async c => {
  manager(c); const data = await body(c, ['username','display_name','email','role','status','password']); const fields = userData(data);
  const username = str(data.username, 'username', 64, true).toLowerCase(); if (!/^[a-z0-9_.-]{3,64}$/.test(username)) fail('Username must be 3–64 letters, numbers, dots, underscores or hyphens');
  const hash = await passwordHash(data.password); const id = crypto.randomUUID();
  await c.env.DB.batch([stmt(c, 'INSERT INTO users (id,username,password_hash,display_name,email,role,status) VALUES (?,?,?,?,?,?,?)', id, username, hash, fields.display_name, fields.email, fields.role, fields.status), audit(c, 'create', 'user', id, { username, role: fields.role, status: fields.status })]);
  return c.json({ ok: true, id }, 201);
});
app.put('/users/:id', async c => {
  manager(c); const id = str(c.req.param('id'), 'id', 100, true); const old = await exists(c, 'users', id);
  const data = await body(c, ['display_name','email','role','status','password']); const fields = userData(data);
  if (id === c.get('user').id && (fields.role !== 'manager' || fields.status !== 'active')) fail('You cannot disable or demote your own account', 409);
  const changingPassword = data.password !== undefined && data.password !== '';
  const hash = changingPassword ? await passwordHash(data.password) : old.password_hash;
  const revoke = changingPassword || fields.role !== old.role || fields.status !== old.status;
  await c.env.DB.batch([
    stmt(c, "UPDATE users SET display_name=?,email=?,role=?,status=?,password_hash=?,updated_at=datetime('now') WHERE id=?", fields.display_name, fields.email, fields.role, fields.status, hash, id),
    ...(revoke ? [stmt(c, 'DELETE FROM sessions WHERE user_id=?', id)] : []),
    audit(c, 'update', 'user', id, { role: fields.role, status: fields.status, password_changed: changingPassword, sessions_revoked: revoke }),
  ]);
  return c.json({ ok: true, id });
});
// ponytail: ดึงข้อมูลช่องจาก YouTube API ฝั่งเซิร์ฟเวอร์ (คีย์ไม่หลุดไป frontend)
app.post('/youtube/import', async c => {
  const key = c.env.YOUTUBE_API_KEY;
  if (!key) fail('ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY บนเซิร์ฟเวอร์', 500);
  const { input } = await body(c, ['input']);
  const ref = str(input, 'ช่อง YouTube', 200, true);
  const idMatch = ref.match(/(UC[\w-]{22})/);
  const handleMatch = ref.match(/@([\w.-]{3,})/);
  const query = idMatch ? `id=${idMatch[1]}` : handleMatch ? `forHandle=${encodeURIComponent(handleMatch[1])}` : fail('ใส่ channel ID, @handle หรือลิงก์ YouTube', 400);
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${query}&key=${encodeURIComponent(key)}`, { headers: { Referer: new URL(c.req.url).origin } });
  if (!res.ok) fail(`ดึงข้อมูลจาก YouTube ไม่สำเร็จ (${res.status})`, 502);
  const item = (await res.json()).items?.[0];
  if (!item) fail('ไม่พบช่องนี้บน YouTube', 404);
  const stats = item.statistics || {};
  const followers = Number(stats.subscriberCount || 0), views = Number(stats.viewCount || 0), videos = Number(stats.videoCount || 0);
  const thumbs = item.snippet?.thumbnails || {};
  const name = item.snippet?.title || 'Unknown';
  const avatar = thumbs.medium?.url || thumbs.default?.url || '';
  const youtubeUrl = `https://www.youtube.com/channel/${item.id}`;
  const now = new Date().toISOString();
  const existing = await stmt(c, 'SELECT id FROM vtubers WHERE youtube_url=? OR channel_url=?', youtubeUrl, youtubeUrl).first();
  if (existing) {
    await c.env.DB.batch([
      stmt(c, 'UPDATE vtubers SET name=?,avatar=?,youtube_url=?,channel_url=?,updated_at=datetime(?) WHERE id=?', name, avatar, youtubeUrl, youtubeUrl, now, existing.id),
      stmt(c, 'INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)', existing.id, followers, views, videos, now),
      audit(c, 'youtube.import', 'vtuber', existing.id, { followers }),
    ]);
    return c.json({ ok: true, id: existing.id, name, followers, total_views: views, video_count: videos, updated: true });
  }
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'channel';
  let slug = base, n = 1;
  while (await stmt(c, 'SELECT id FROM vtubers WHERE slug=?', slug).first()) { n += 1; if (n > 9) fail('Slug ซ้ำเกินไป'); slug = `${base}-${n}`; }
  const inserted = await stmt(c, "INSERT INTO vtubers (name,slug,bio,avatar,channel_url,platform,category,affiliation,is_active,youtube_url,created_at,updated_at) VALUES (?,?,?,?,?,?,'other','indie',1,?,datetime('now'),datetime('now'))", name, slug, (item.snippet?.description || '').slice(0, 2000), avatar, youtubeUrl, 'youtube', youtubeUrl).run();
  const id = inserted.meta.last_row_id;
  await c.env.DB.batch([
    stmt(c, 'INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)', id, followers, views, videos, now),
    audit(c, 'youtube.import', 'vtuber', id, { slug, followers }),
  ]);
  return c.json({ ok: true, id, name, slug, followers, total_views: views, video_count: videos }, 201);
});
export default app;
