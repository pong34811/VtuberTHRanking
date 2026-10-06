import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hashPassword, validatePassword } from './password.js';
import { fail, choice, str, url, month, selection, csvCell, body, channel, channelFields } from './admin-domain.js';
import { calculateRanking } from './ranking-service.js';
import { HOMEPAGE_TEMPLATE_IDS, normalizeHomepageTemplate } from '../../shared/homepage-templates.js';
import { INTRO_HOMEPAGE_TEMPLATE_IDS, normalizeIntroHomepageTemplate } from '../../shared/intro-homepage-templates.js';
import { strictIsoTimestamp } from './request-validation.js';
import { IMPORT_BODY_LIMIT, logSafeError } from './request-body.js';
import { readSiteConfig } from './site-config.js';
import { readYouTubeStatistics } from '../../shared/youtube-statistics.js';
import { candidateUpsert, canonicalYouTubeUrl } from '../../shared/directory-candidates.js';
import { youtubeReference, youtubeChannelLookup as importedChannelLookup, readYouTubeProfile } from '../../shared/youtube-profile.js';

const app = new Hono();
const userFields = 'id,username,display_name,email,role,status,created_at,updated_at,last_login_at';
const stmt = (c, sql, ...values) => c.env.DB.prepare(sql).bind(...values);
const list = async (c, sql, ...values) => c.json(await stmt(c, sql, ...values).all().then(({ results }) => ({ results })));
const manager = c => { if (c.get('user')?.role !== 'manager') fail('Manager access required', 403); };
const numericId = c => { const id = Number(c.req.param('id')); if (!Number.isSafeInteger(id) || id < 1) fail('Invalid ID'); return id; };
const audit = (c, action, target, id, details = {}) => stmt(c, 'INSERT INTO audit_logs (id,user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)', crypto.randomUUID(), c.get('user').id, action, target, String(id), JSON.stringify(details));
// Lookups below are fixed SQL/natural keys, resolved inside the same batch.
// Never depend on connection-scoped last_insert_rowid() across D1 statements.
const auditLookup = (c, action, target, lookup, values, details = {}) => stmt(c,
  `INSERT INTO audit_logs (id,user_id,action,target_type,target_id,details) VALUES (?,?,?,?,CAST((${lookup}) AS TEXT),?)`,
  crypto.randomUUID(), c.get('user').id, action, target, ...values, JSON.stringify(details));
const exists = async (c, table, id) => { const row = await stmt(c, `SELECT * FROM ${table} WHERE id=?`, id).first(); if (!row) fail('Record not found', 404); return row; };
app.use('*', async (c, next) => { if (!c.get('user') || c.get('user').status !== 'active') fail('Authentication required', 401); await next(); });
app.onError((error, c) => {
  if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
  if (error.code === 'RANKING_CHANNEL_LIMIT') return c.json({ message: error.message }, 409);
  if (/directory_candidate_stale/.test(error.message)) return c.json({ message: 'Candidate changed or channel already registered' }, 409);
  if (/UNIQUE constraint failed/i.test(error.message)) return c.json({ message: 'A record with this unique value already exists' }, 409);
  logSafeError('Admin operation failed');
  return c.json({ message: 'Unable to complete operation' }, 500);
});

app.get('/vtubers', c => list(c, 'SELECT * FROM vtubers ORDER BY name,id LIMIT 2000'));
async function channelAgency(c, data) {
  if (data.affiliation !== 'agency') return data;
  const agency = await stmt(c, 'SELECT name FROM agencies WHERE id=?', data.agency_id).first();
  if (!agency) fail('ไม่พบสังกัดที่เลือก', 400);
  return { ...data, agency_name: agency.name };
}
app.post('/vtubers', async c => {
  const data = await channelAgency(c, channel(await body(c, channelFields)));
  if (data.platform === 'youtube' || data.youtube_url || youtubeReference(data.channel_url)) {
    const item = await youtubeChannel(c, data.youtube_url || data.channel_url);
    return queueCandidate(c, item, data);
  }
  const fields = Object.keys(data);
  const result = await c.env.DB.batch([
    stmt(c, `INSERT INTO vtubers (${fields.join(',')},created_at,updated_at) VALUES (${fields.map(() => '?').join(',')},datetime('now'),datetime('now'))`, ...Object.values(data)),
    auditLookup(c, 'create', 'vtuber', 'SELECT id FROM vtubers WHERE slug=?', [data.slug], { slug: data.slug }),
  ]);
  return c.json({ ok: true, id: result[0].meta.last_row_id }, 201);
});
app.put('/vtubers/:id', async c => {
  const id = numericId(c); const old = await exists(c, 'vtubers', id);
  const data = await channelAgency(c, channel(await body(c, channelFields)));
  if (data.platform === 'youtube' || data.youtube_url || youtubeReference(data.channel_url)) {
    const changed = ['youtube_url','channel_url'].filter(field => data[field] && data[field] !== (old[field] || ''));
    if (changed.length) {
      const oldReference = youtubeReference(old.youtube_url) || youtubeReference(old.channel_url);
      if (!oldReference) fail('Channel identity changes require queue and approval', 409);
      const oldId = oldReference.id || (await youtubeChannel(c, old.youtube_url || old.channel_url)).id;
      for (const field of changed) {
        const reference = youtubeReference(data[field]);
        if (!reference) fail('Invalid YouTube channel reference');
        const nextId = reference.id || (await youtubeChannel(c, data[field])).id;
        if (nextId !== oldId) fail('Channel identity changes require queue and approval', 409);
        const pending = await stmt(c, "SELECT channel_id FROM directory_candidates WHERE channel_id=? AND status='pending'", nextId).first();
        if (pending) fail('Pending channel requires manager approval', 409);
      }
    }
  }
  await c.env.DB.batch([stmt(c, `UPDATE vtubers SET ${Object.keys(data).map(key => `${key}=?`).join(',')},updated_at=datetime('now') WHERE id=?`, ...Object.values(data), id), audit(c, 'update', 'vtuber', id, { fields: Object.keys(data) })]);
  return c.json({ ok: true, id });
});

const agencyFields = ['name','description','image_url','contact'];
function agencyData(data) {
  return {
    name: str(data.name, 'name', 100, true),
    description: str(data.description ?? '', 'description', 5000),
    image_url: url(data.image_url, 'image_url'),
    contact: str(data.contact ?? '', 'contact', 2000),
  };
}
app.get('/agencies', c => list(c, 'SELECT a.*, (SELECT COUNT(*) FROM vtubers v WHERE v.agency_id=a.id) AS channel_count FROM agencies a ORDER BY a.name,id LIMIT 2000'));
app.post('/agencies', async c => {
  const data = agencyData(await body(c, agencyFields));
  const result = await c.env.DB.batch([
    stmt(c, 'INSERT INTO agencies (name,description,image_url,contact) VALUES (?,?,?,?)', ...Object.values(data)),
    auditLookup(c, 'create', 'agency', 'SELECT id FROM agencies WHERE name=?', [data.name], { name: data.name }),
  ]);
  return c.json({ ok: true, id: result[0].meta.last_row_id }, 201);
});
app.put('/agencies/:id', async c => {
  const id = numericId(c); await exists(c, 'agencies', id);
  const data = agencyData(await body(c, agencyFields));
  await c.env.DB.batch([
    stmt(c, "UPDATE agencies SET name=?,description=?,image_url=?,contact=?,updated_at=datetime('now') WHERE id=?", ...Object.values(data), id),
    stmt(c, 'UPDATE vtubers SET agency_name=?,updated_at=datetime(\'now\') WHERE agency_id=?', data.name, id),
    audit(c, 'update', 'agency', id),
  ]);
  return c.json({ ok: true, id });
});
app.delete('/agencies/:id', async c => {
  const id = numericId(c); await exists(c, 'agencies', id);
  const used = await stmt(c, 'SELECT COUNT(*) AS total FROM vtubers WHERE agency_id=?', id).first();
  if (used?.total) fail('สังกัดนี้มีช่องใช้งานอยู่ กรุณาย้ายช่องก่อนลบ', 409);
  await c.env.DB.batch([stmt(c, 'DELETE FROM agencies WHERE id=?', id), audit(c, 'delete', 'agency', id)]);
  return c.json({ ok: true });
});
app.get('/vtubers/:id/snapshots', async c => { const id = numericId(c); await exists(c, 'vtubers', id); return list(c, 'SELECT * FROM stats_snapshots WHERE vtuber_id=? ORDER BY julianday(recorded_at) DESC,id DESC LIMIT 500', id); });
app.post('/vtubers/:id/snapshots', async c => {
  const id = numericId(c); await exists(c, 'vtubers', id);
  const data = await body(c, ['followers','total_views','video_count','recorded_at']);
  for (const field of ['followers','total_views','video_count']) if (!Number.isSafeInteger(data[field]) || data[field] < 0) fail(`Invalid ${field}`);
  const recorded = strictIsoTimestamp(data.recorded_at);
  await c.env.DB.batch([stmt(c, 'INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)', id, data.followers, data.total_views, data.video_count, recorded), audit(c, 'snapshot.create', 'vtuber', id, { recorded_at: recorded })]);
  return c.json({ ok: true }, 201);
});

app.get('/categories', c => list(c, "SELECT * FROM categories WHERE id IN ('followers','views','videos') ORDER BY sort_order,id"));
app.put('/categories/:id', async c => {
  manager(c); const id = choice(c.req.param('id'), ['followers','views','videos'], 'category'); const old = await exists(c, 'categories', id);
  const data = await body(c, ['id','name','slug','description','sort_order','status']);
  if (data.id !== undefined && data.id !== id) fail('Category ID cannot change');
  if (data.slug !== undefined && data.slug !== old.slug) fail('Category slug cannot change');
  const name = str(data.name, 'name', 100, true);
  const description = str(data.description ?? '', 'description', 2000);
  if (!Number.isInteger(data.sort_order) || data.sort_order < 0 || data.sort_order > 1000) fail('Invalid sort_order');
  choice(data.status, ['active','inactive'], 'status');
  await c.env.DB.batch([stmt(c, 'UPDATE categories SET name=?,description=?,sort_order=?,status=? WHERE id=?', name, description, data.sort_order, data.status, id), audit(c, 'update', 'category', id)]);
  return c.json({ ok: true, id });
});

const rankingRows = async (c, filter) => (await stmt(c, 'SELECT r.*,v.name,v.slug FROM rankings r JOIN vtubers v ON v.id=r.vtuber_id WHERE r.period=? AND r.category=? AND r.month IS ? ORDER BY r.rank,r.vtuber_id', filter.period, filter.category, filter.month).all()).results;
async function configuredSelection(c, input) {
  const filter = selection(input);
  if (filter.period === 'monthly' && !input.month) filter.month = `${(await readSiteConfig(c.env.DB)).current_ranking_period}-01`;
  return filter;
}
app.get('/rankings', async c => c.json({ results: await rankingRows(c, await configuredSelection(c, c.req.query())) }));
app.post('/rankings/calculate', async c => {
  manager(c); const filter = await configuredSelection(c, await body(c, ['period','month','category']));
  const { count } = await calculateRanking(c.env.DB, filter, count => [
    audit(c, 'calculate', 'ranking', `${filter.period}:${filter.month || 'alltime'}:${filter.category}`, { count }),
  ]);
  return c.json({ ok: true, count });
});
app.get('/reports', c => list(c, 'SELECT id,report_type,report_period,category_id,total_vtubers,generated_at,generated_by FROM reports ORDER BY generated_at DESC,id DESC LIMIT 200'));
app.post('/reports', async c => {
  const filter = await configuredSelection(c, await body(c, ['period','month','category'])); const rows = await rankingRows(c, filter);
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
app.get('/pipeline-runs', c => {
  manager(c);
  return list(c, 'SELECT id,trigger_source,frequency,status,started_at,completed_at,channels_total,snapshots_written,rankings_published,error_summary FROM ranking_pipeline_runs ORDER BY started_at DESC,id DESC LIMIT 10');
});

app.get('/directory-sync', async c => {
  manager(c); c.header('Cache-Control', 'no-store');
  const [runs, candidates, sweep] = await Promise.all([
    stmt(c, 'SELECT * FROM directory_sync_runs ORDER BY started_at DESC,id DESC LIMIT 10').all(),
    stmt(c, "SELECT channel_id,name,source_url,reason,checked_at FROM directory_candidates WHERE status='pending' ORDER BY checked_at DESC,channel_id LIMIT 100").all(),
    stmt(c, 'SELECT day,query_index,completed,json_array_length(items_json) AS remaining_items FROM directory_search_checkpoint WHERE id=1').first(),
  ]);
  return c.json({ runs: runs.results, candidates: candidates.results, sweep });
});
function candidateId(c) {
  const id = c.req.param('id');
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) fail('Invalid channel ID');
  return id;
}
const channelAlias = item => {
  const handle = item.snippet?.customUrl || item.inputHandle;
  return typeof handle === 'string' && /^@[^/?#\s]+$/.test(handle) ? `https://www.youtube.com/${handle}` : canonicalYouTubeUrl(item.id);
};
const pendingAssertion = (c, id, newIdentity = false, alias = canonicalYouTubeUrl(id)) => stmt(c, `INSERT INTO directory_candidate_assertions(valid)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM directory_candidates WHERE channel_id=? AND status='pending')
  ${newIdentity ? `AND NOT EXISTS (${importedChannelLookup})` : ''} THEN 1 ELSE 0 END`,
  id, ...(newIdentity ? [canonicalYouTubeUrl(id), alias] : []));
async function existingYouTubeChannel(c, item) {
  const canonical = canonicalYouTubeUrl(item.id);
  const alias = channelAlias(item);
  const existing = await stmt(c, importedChannelLookup, canonical, alias).first();
  if (existing || item.snippet?.customUrl) return existing;
  const { results: rows = [] } = await stmt(c, `SELECT id,youtube_url,channel_url FROM vtubers WHERE platform='youtube' OR platform IS NULL`).all();
  let requests = 0;
  for (const row of rows) {
    const ref = youtubeReference(row.youtube_url) || youtubeReference(row.channel_url);
    if (!ref?.forHandle) continue;
    // ponytail: at most 20 legacy handle resolutions per manual action; record baselines for larger legacy directories.
    if (++requests > 20) fail('Existing channel identities need verification before queueing', 409);
    let resolved;
    try { resolved = await youtubeChannel(c, ref.forHandle); }
    catch { fail('Existing channel identity could not be verified', 409); }
    if (resolved.id === item.id) return row;
  }
  return null;
}
async function queueCandidate(c, item, review = {}) {
  const profile = readYouTubeProfile(item);
  if (!profile) fail('Invalid YouTube channel profile', 502);
  const url = canonicalYouTubeUrl(item.id);
  const existing = await existingYouTubeChannel(c, item);
  const previous = await stmt(c, 'SELECT status FROM directory_candidates WHERE channel_id=?', item.id).first();
  if (existing || (previous && previous.status !== 'pending')) fail('Channel already registered or reviewed', 409);
  const stats = readYouTubeStatistics(item.statistics);
  await c.env.DB.batch([
    stmt(c, candidateUpsert, item.id, profile.name, url, url, stats.ok ? 'Manager review required' : stats.reason,
      new Date().toISOString(), JSON.stringify(profile), JSON.stringify([{ source: url, kind: 'youtube-profile', description: profile.bio }]), JSON.stringify(review)),
    pendingAssertion(c, item.id, true, channelAlias(item)),
    audit(c, 'candidate.queue', 'directory_candidate', item.id),
    stmt(c, 'DELETE FROM directory_candidate_assertions'),
  ]);
  return c.json({ ok: true, queued: true, channel_id: item.id, name: profile.name }, 202);
}
app.get('/directory-candidates', async c => {
  manager(c); c.header('Cache-Control', 'no-store');
  const q = str(c.req.query('q') ?? '', 'q', 100);
  const parse = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) fail('Invalid pagination');
    return Number(value);
  };
  const limit = parse(c.req.query('limit'), 20, 100);
  const offset = parse(c.req.query('offset'), 0, 1000000);
  if (limit < 1) fail('Invalid pagination');
  const filter = "status='pending' AND instr(lower(name),lower(?))>0";
  const [rows, count] = await Promise.all([
    stmt(c, `SELECT * FROM directory_candidates WHERE ${filter} ORDER BY checked_at DESC,channel_id LIMIT ? OFFSET ?`, q, limit, offset).all(),
    stmt(c, `SELECT COUNT(*) AS total FROM directory_candidates WHERE ${filter}`, q).first(),
  ]);
  return c.json({ results: rows.results, total: count.total, limit, offset });
});
app.post('/directory-candidates', async c => {
  manager(c);
  const { input } = await body(c, ['input'], IMPORT_BODY_LIMIT);
  return queueCandidate(c, await youtubeChannel(c, input));
});
app.post('/directory-candidates/:id/approve', async c => {
  manager(c); const id = candidateId(c);
  const pending = await stmt(c, 'SELECT * FROM directory_candidates WHERE channel_id=?', id).first();
  if (!pending) fail('Candidate not found', 404);
  if (pending.status !== 'pending') fail('Candidate changed or already reviewed', 409);
  const input = await body(c, channelFields);
  choice(input.affiliation, ['indie','agency'], 'affiliation');
  const url = canonicalYouTubeUrl(id);
  if ((input.youtube_url && input.youtube_url !== url) || (input.channel_url && input.channel_url !== url) || (input.platform && input.platform !== 'youtube')) fail('Candidate channel identity cannot change');
  const item = await youtubeChannel(c, id);
  const profile = readYouTubeProfile(item);
  if (!profile || item.id !== id) fail('YouTube channel profile unavailable', 502);
  if (await existingYouTubeChannel(c, item)) fail('Channel already registered', 409);
  const data = await channelAgency(c, channel({ ...input, platform: 'youtube', youtube_url: url, channel_url: url }));
  const stats = readYouTubeStatistics(item.statistics);
  const now = new Date().toISOString();
  const saved = await c.env.DB.batch([
    pendingAssertion(c, id, true, channelAlias(item)),
    stmt(c, `INSERT INTO vtubers (${Object.keys(data).join(',')},created_at,updated_at) VALUES (${Object.keys(data).map(() => '?').join(',')},datetime('now'),datetime('now'))`, ...Object.values(data)),
    stmt(c, `UPDATE directory_candidates SET status='imported',vtuber_id=(SELECT id FROM vtubers WHERE slug=?),checked_at=?,profile_json=? WHERE channel_id=? AND status='pending'`, data.slug, now, JSON.stringify(profile), id),
    ...(stats.ok ? [stmt(c, `INSERT INTO stats_snapshots(vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES ((SELECT vtuber_id FROM directory_candidates WHERE channel_id=?),?,?,?,0,?)`, id, stats.followers, stats.total_views, stats.video_count, now)] : []),
    stmt(c, `INSERT INTO youtube_profile_state(vtuber_id,channel_id,profile_json,reference_json,source_url,checked_at) SELECT vtuber_id,?,?,json_object('youtube_url',?,'channel_url',?),?,? FROM directory_candidates WHERE channel_id=?`, id, JSON.stringify(profile), url, url, url, now, id),
    audit(c, 'candidate.approve', 'directory_candidate', id, { slug: data.slug, snapshot: stats.ok, affiliation: data.affiliation }),
    stmt(c, 'DELETE FROM directory_candidate_assertions'),
    stmt(c, 'SELECT vtuber_id FROM directory_candidates WHERE channel_id=?', id),
  ]);
  return c.json({ ok: true, id: saved.at(-1).results[0].vtuber_id, channel_id: id, snapshot: stats.ok }, 201);
});
app.post('/directory-candidates/:id/ignore', async c => {
  manager(c); const id = candidateId(c);
  if (!await stmt(c, 'SELECT channel_id FROM directory_candidates WHERE channel_id=?', id).first()) fail('Candidate not found', 404);
  await c.env.DB.batch([
    pendingAssertion(c, id),
    stmt(c, "UPDATE directory_candidates SET status='ignored' WHERE channel_id=? AND status='pending'", id),
    audit(c, 'update', 'directory_candidate', id, { status: 'ignored' }),
    stmt(c, 'DELETE FROM directory_candidate_assertions'),
  ]);
  return c.json({ ok: true });
});
const settingsKeys = ['site_name','site_status','current_ranking_period','ranking_update_frequency','directory_sync_enabled'];
app.get('/settings', c => list(c, `SELECT * FROM settings WHERE setting_key IN (${settingsKeys.map(() => '?').join(',')}) ORDER BY setting_key`, ...settingsKeys));
app.get('/settings/homepage-template', async c => {
  manager(c);
  const row = await stmt(c, 'SELECT setting_value FROM settings WHERE setting_key=?', 'homepage_template').first();
  return c.json({ homepage_template: normalizeHomepageTemplate(row?.setting_value) });
});
app.put('/settings/homepage-template', async c => {
  manager(c);
  const data = await body(c, ['homepage_template']);
  choice(data.homepage_template, HOMEPAGE_TEMPLATE_IDS, 'homepage_template');
  await c.env.DB.batch([
    stmt(c, "INSERT INTO settings (setting_key,setting_value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at", 'homepage_template', data.homepage_template),
    audit(c, 'update', 'settings', 'homepage_template', { homepage_template: data.homepage_template }),
  ]);
  return c.json({ ok: true, homepage_template: data.homepage_template });
});
app.get('/settings/intro-homepage-template', async c => {
  manager(c);
  c.header('Cache-Control', 'no-store');
  const row = await stmt(c, 'SELECT setting_value FROM settings WHERE setting_key=?', 'intro_homepage_template').first();
  return c.json({ intro_homepage_template: normalizeIntroHomepageTemplate(row?.setting_value) });
});
app.put('/settings/intro-homepage-template', async c => {
  manager(c);
  const data = await body(c, ['intro_homepage_template']);
  choice(data.intro_homepage_template, INTRO_HOMEPAGE_TEMPLATE_IDS, 'intro_homepage_template');
  await c.env.DB.batch([
    stmt(c, "INSERT INTO settings (setting_key,setting_value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at", 'intro_homepage_template', data.intro_homepage_template),
    audit(c, 'update', 'settings', 'intro_homepage_template', { intro_homepage_template: data.intro_homepage_template }),
  ]);
  return c.json({ ok: true, intro_homepage_template: data.intro_homepage_template });
});
app.put('/settings', async c => {
  manager(c); const data = await body(c, settingsKeys);
  data.site_name = str(data.site_name, 'site_name', 100, true);
  choice(data.site_status, ['active','maintenance'], 'site_status'); month(data.current_ranking_period); choice(data.ranking_update_frequency, ['manual','hourly','daily','weekly','monthly'], 'ranking_update_frequency');
  // Older clients omit this field; preserve the saved value rather than disabling discovery.
  data.directory_sync_enabled ??= (await stmt(c, "SELECT setting_value FROM settings WHERE setting_key='directory_sync_enabled'").first())?.setting_value || 'false';
  choice(data.directory_sync_enabled, ['true','false'], 'directory_sync_enabled');
  await c.env.DB.batch([...settingsKeys.map(key => stmt(c, "INSERT INTO settings (setting_key,setting_value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at", key, data[key])), audit(c, 'update', 'settings', 'site', data)]);
  return c.json({ ok: true });
});

function userData(data) {
  const displayName = str(data.display_name, 'display_name', 100, true); const email = str(data.email, 'email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email');
  return { display_name: displayName, email, role: choice(data.role, ['manager','staff'], 'role'), status: choice(data.status, ['active','inactive'], 'status') };
}
async function passwordHash(password) {
  try { validatePassword(password); } catch (error) { fail(error.message); }
  return hashPassword(password);
}
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
// ดึงข้อมูลจาก YouTube API ฝั่งเซิร์ฟเวอร์ เพื่อไม่ส่งคีย์ให้เบราว์เซอร์
async function youtubeChannel(c, input) {
  const key = c.env.YOUTUBE_API_KEY;
  if (!key) fail('ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY บนเซิร์ฟเวอร์', 500);
  const ref = str(input, 'ช่อง YouTube', 200, true);
  const reference = /^UC[A-Za-z0-9_-]{22}$/.test(ref) ? { id: ref }
    : /^@[^/?#\s]+$/.test(ref) ? { forHandle: ref } : youtubeReference(ref);
  if (!reference) fail('ใส่ channel ID, @handle หรือลิงก์ YouTube', 400);
  const query = new URLSearchParams(reference).toString();
  let res;
  try {
    res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${query}&key=${encodeURIComponent(key)}`, { headers: { Referer: new URL(c.req.url).origin }, signal: AbortSignal.timeout(15000) });
  } catch { fail('ดึงข้อมูลจาก YouTube ไม่สำเร็จ', 502); }
  if (!res.ok) fail(`ดึงข้อมูลจาก YouTube ไม่สำเร็จ (${res.status})`, 502);
  let payload;
  try { payload = await res.json(); } catch { fail('Invalid YouTube API response', 502); }
  if (!payload || !Array.isArray(payload.items)) fail('Invalid YouTube API response', 502);
  const item = payload.items[0];
  if (!item) fail('ไม่พบช่องนี้บน YouTube', 404);
  if (typeof item.id !== 'string' || !/^UC[\w-]{22}$/.test(item.id)) fail('Invalid YouTube API response', 502);
  if (reference.id && reference.id !== item.id) fail('Invalid YouTube API response', 502);
  item.inputHandle = reference.forHandle;
  return item;
}
app.post('/agencies/youtube/import', async c => {
  const { input } = await body(c, ['input'], IMPORT_BODY_LIMIT);
  const item = await youtubeChannel(c, input);
  const youtubeUrl = `https://www.youtube.com/channel/${item.id}`;
  if (await stmt(c, 'SELECT id FROM agencies WHERE youtube_channel_id=?', item.id).first()) fail('สังกัดนี้มีในระบบแล้ว', 409);
  const data = agencyData({
    name: item.snippet?.title || 'Unknown',
    description: item.snippet?.description || '',
    image_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    contact: youtubeUrl,
  });
  const result = await c.env.DB.batch([
    stmt(c, 'INSERT INTO agencies (name,description,image_url,contact,youtube_channel_id) VALUES (?,?,?,?,?)', ...Object.values(data), item.id),
    auditLookup(c, 'youtube.import', 'agency', 'SELECT id FROM agencies WHERE youtube_channel_id=?', [item.id], { youtube_channel_id: item.id }),
  ]);
  return c.json({ ok: true, id: result[0].meta.last_row_id }, 201);
});
app.post('/youtube/import', async c => {
  const { input } = await body(c, ['input'], IMPORT_BODY_LIMIT);
  const item = await youtubeChannel(c, input);
  const youtubeUrl = canonicalYouTubeUrl(item.id);
  const existing = await existingYouTubeChannel(c, item);
  if (!existing) return queueCandidate(c, item);
  const current = await exists(c, 'vtubers', existing.id);
  const stats = readYouTubeStatistics(item.statistics);
  if (!stats.ok) fail(stats.reason, 502);
  const { followers, total_views: views, video_count: videos } = stats;
  const profile = readYouTubeProfile(item);
  const thumbs = item.snippet?.thumbnails || {};
  const name = profile?.name || item.snippet?.title || 'Unknown';
  const avatar = thumbs.medium?.url || thumbs.default?.url || '';
  const now = new Date().toISOString();
  const sourceStatements = profile ? [stmt(c, `INSERT INTO youtube_profile_state(vtuber_id,channel_id,profile_json,reference_json,source_url,checked_at)
    SELECT id,?,?,json_object('youtube_url',youtube_url,'channel_url',channel_url),?,? FROM vtubers WHERE id=(${importedChannelLookup})
    ON CONFLICT(vtuber_id) DO UPDATE SET channel_id=excluded.channel_id,profile_json=excluded.profile_json,reference_json=excluded.reference_json,source_url=excluded.source_url,checked_at=excluded.checked_at`,
    item.id, JSON.stringify(profile), youtubeUrl, now, youtubeUrl, youtubeUrl)] : [];
  await c.env.DB.batch([
    stmt(c, `INSERT INTO directory_candidate_assertions(valid) SELECT CASE WHEN EXISTS (SELECT 1 FROM vtubers WHERE id=? AND COALESCE(youtube_url,'')=? AND COALESCE(channel_url,'')=?) THEN 1 ELSE 0 END`, existing.id, current.youtube_url || '', current.channel_url || ''),
    stmt(c, 'UPDATE vtubers SET name=?,avatar=?,youtube_url=?,channel_url=?,updated_at=datetime(?) WHERE id=?', name, avatar, youtubeUrl, youtubeUrl, now, existing.id),
    stmt(c, 'INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)', existing.id, followers, views, videos, now),
    audit(c, 'youtube.import', 'vtuber', existing.id, { followers }),
    ...sourceStatements,
    stmt(c, 'DELETE FROM directory_candidate_assertions'),
  ]);
  return c.json({ ok: true, id: existing.id, name, followers, total_views: views, video_count: videos, updated: true });
});
export default app;
