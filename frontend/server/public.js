import { Hono } from 'hono';
import { currentMonth } from './ranking-period.js';
import { normalizeHomepageTemplate } from '../../shared/homepage-templates.js';

const api = new Hono();

const pageInteger = (value, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^\d+$/.test(value || '')) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};

api.get('/', (c) => c.json({ status: 'ok', service: 'VTuber Thai Ranking API' }));

api.get('/rankings/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  let period = c.req.query('period') || 'monthly';
  let category = c.req.query('category') || 'followers';
  const monthStr = c.req.query('month');
  const limit = pageInteger(c.req.query('limit'), 50, 1, 100);
  const offset = pageInteger(c.req.query('offset'), 0, 0);

  if (!['monthly', 'alltime'].includes(period)) period = 'monthly';
  if (!['followers', 'views', 'videos'].includes(category)) category = 'followers';

  let monthDate = null;
  if (period !== 'alltime') {
    if (monthStr && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
      monthDate = monthStr + '-01';
    } else {
      monthDate = `${currentMonth()}-01`;
    }
  }

  let whereClause = 'WHERE r.period = ? AND r.category = ?';
  const params = [period, category];

  if (period === 'alltime') {
    whereClause += ' AND r.month IS NULL';
  } else {
    whereClause += ' AND r.month = ?';
    params.push(monthDate);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM rankings r ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const query = `SELECT r.rank, r.score, r.rank_change, r.video_count, v.id, v.name, v.slug, v.avatar, v.category as vtuber_category, v.affiliation
    FROM rankings r JOIN vtubers v ON r.vtuber_id = v.id ${whereClause} ORDER BY r.rank ASC LIMIT ? OFFSET ?`;

  const { results } = await db.prepare(query).bind(...params, limit, offset).all();

  const pageLink = (pageOffset) => {
    const query = new URLSearchParams({ period, category, limit: String(limit), offset: String(pageOffset) });
    if (monthDate) query.set('month', monthDate.slice(0, 7));
    return `/api/v1/rankings/?${query}`;
  };

  return c.json({
    period, category,
    month: monthDate ? monthDate.slice(0, 7) : null,
    total, count: results.length,
    next: offset + limit < total ? pageLink(offset + limit) : null,
    previous: offset > 0 ? pageLink(Math.max(0, offset - limit)) : null,
    results: results.map(row => ({
      rank: row.rank,
      vtuber: { id: row.id, name: row.name, slug: row.slug, avatar: row.avatar, category: row.vtuber_category, affiliation: row.affiliation, video_count: row.video_count },
      score: row.score, rank_change: row.rank_change,
    })),
  });
});

api.get('/vtubers/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const q = c.req.query('q'), category = c.req.query('category'), affiliation = c.req.query('affiliation');
  const parseFollowerBound = (raw) => {
    if (raw == null || raw === '') return { valid: true, value: null };
    if (!/^\d+$/.test(raw)) return { valid: false, value: null };
    const value = Number(raw);
    return { valid: Number.isSafeInteger(value), value: Number.isSafeInteger(value) ? value : null };
  };
  const minFollowers = parseFollowerBound(c.req.query('min_followers'));
  const maxFollowers = parseFollowerBound(c.req.query('max_followers'));
  if (!minFollowers.valid || !maxFollowers.valid || (minFollowers.value != null && maxFollowers.value != null && minFollowers.value > maxFollowers.value)) {
    return c.json({ error: true, status: 400, message: 'Invalid follower range' }, 400);
  }

  const requestedSort = c.req.query('sort');
  const sort = ['name', 'followers_desc', 'followers_asc'].includes(requestedSort) ? requestedSort : 'name';
  const fromClause = `FROM vtubers v LEFT JOIN stats_snapshots latest ON latest.id = (
    SELECT s.id FROM stats_snapshots s WHERE s.vtuber_id = v.id
    ORDER BY s.recorded_at DESC, s.id DESC LIMIT 1
  )`;
  let whereClause = 'WHERE v.is_active = 1', params = [];
  if (q) { whereClause += ' AND v.name LIKE ?'; params.push(`%${q}%`); }
  if (category) { whereClause += ' AND v.category = ?'; params.push(category); }
  if (affiliation) { whereClause += ' AND v.affiliation = ?'; params.push(affiliation); }
  if (minFollowers.value != null) { whereClause += ' AND latest.followers >= ?'; params.push(minFollowers.value); }
  if (maxFollowers.value != null) { whereClause += ' AND latest.followers <= ?'; params.push(maxFollowers.value); }
  const countResult = await db.prepare(`SELECT COUNT(*) as count ${fromClause} ${whereClause}`).bind(...params).first();
  const orderClause = sort === 'followers_desc'
    ? 'CASE WHEN latest.followers IS NULL THEN 1 ELSE 0 END ASC, latest.followers DESC, v.name COLLATE NOCASE ASC, v.id ASC'
    : sort === 'followers_asc'
      ? 'CASE WHEN latest.followers IS NULL THEN 1 ELSE 0 END ASC, latest.followers ASC, v.name COLLATE NOCASE ASC, v.id ASC'
      : 'v.name COLLATE NOCASE ASC, v.id ASC';
  const { results } = await db.prepare(`SELECT v.id, v.name, v.slug, v.avatar, v.category, v.affiliation, latest.followers AS followers ${fromClause} ${whereClause} ORDER BY ${orderClause}`).bind(...params).all();
  return c.json({ count: countResult?.count || 0, results });
});

api.get('/vtubers/:slug/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const slug = c.req.param('slug');
  const vtuber = await db.prepare(`SELECT * FROM vtubers WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!vtuber) return c.json({ error: true, status: 404, message: 'VTuber not found' }, 404);
  const { results: rankResults } = await db.prepare(`SELECT period, category, rank FROM rankings
    WHERE vtuber_id = ? AND status = 'active'
    AND ((period = 'monthly' AND month = ?) OR (period = 'alltime' AND month IS NULL))
    ORDER BY period, category`).bind(vtuber.id, `${currentMonth()}-01`).all();
  const currentRank = {};
  for (const r of rankResults) currentRank[`${r.period}_${r.category}`] = r.rank;
  const latestStats = await db.prepare(`SELECT followers, total_views, avg_views, recorded_at FROM stats_snapshots WHERE vtuber_id = ? ORDER BY recorded_at DESC LIMIT 1`).bind(vtuber.id).first();
  const { notes: _internalNotes, ...publicVtuber } = vtuber;
  return c.json({ ...publicVtuber, current_rank: currentRank, latest_stats: latestStats || null });
});

api.get('/vtubers/:slug/history/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const slug = c.req.param('slug');
  let months = parseInt(c.req.query('months') || '6', 10);
  if (months > 12) months = 12; if (months < 1) months = 1;
  const vtuber = await db.prepare(`SELECT id, name, slug FROM vtubers WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!vtuber) return c.json({ error: true, status: 404, message: 'VTuber not found' }, 404);
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const startStr = start.toISOString().slice(0, 10);
  const { results } = await db.prepare(`SELECT date(recorded_at) as date, followers, total_views, avg_views FROM stats_snapshots WHERE vtuber_id = ? AND date(recorded_at) >= ? ORDER BY recorded_at ASC`).bind(vtuber.id, startStr).all();
  return c.json({ vtuber: { id: vtuber.id, name: vtuber.name, slug: vtuber.slug }, history: results });
});

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
api.post('/compare/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  let body; try { body = await c.req.json(); } catch { return c.json({ error: true, status: 400, message: 'Invalid JSON' }, 400); }
  const { vtubers, category = 'followers', months = 6 } = body;
  if (!Array.isArray(vtubers) || vtubers.length < 2 || vtubers.length > 5) return c.json({ error: true, status: 400, message: 'vtubers must be 2-5 IDs' }, 400);
  if (!['followers', 'views', 'videos'].includes(category)) return c.json({ error: true, status: 400, message: 'Invalid category' }, 400);
  const now = new Date(), start = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const startStr = start.toISOString().slice(0, 10);
  const results = [];
  for (let i = 0; i < vtubers.length; i++) {
    const vtuber = await db.prepare(`SELECT id, name, slug FROM vtubers WHERE id = ? AND is_active = 1`).bind(vtubers[i]).first();
    if (!vtuber) continue;
    const column = category === 'followers' ? 'followers' : category === 'videos' ? 'video_count' : 'total_views';
    const { results: snapshots } = await db.prepare(`SELECT date(recorded_at) as date, ${column} as value FROM stats_snapshots WHERE vtuber_id = ? AND date(recorded_at) >= ? ORDER BY recorded_at ASC`).bind(vtuber.id, startStr).all();
    results.push({ id: vtuber.id, name: vtuber.name, slug: vtuber.slug, color: COLORS[i % COLORS.length], history: snapshots });
  }
  return c.json({ category, vtubers: results });
});

api.get('/summary/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const totalResult = await db.prepare('SELECT COUNT(*) as count FROM vtubers WHERE is_active = 1').first();
  const totalVtubers = totalResult?.count || 0;
  const followersResult = await db.prepare(`SELECT MAX(followers) as total FROM stats_snapshots WHERE vtuber_id IN (SELECT id FROM vtubers WHERE is_active = 1)`).first();
  const totalFollowers = followersResult?.total || 0;
  const topGainerResult = await db.prepare(`SELECT v.id, v.name, v.slug, r.rank_change FROM rankings r JOIN vtubers v ON r.vtuber_id = v.id WHERE r.period = 'monthly' AND r.rank_change > 0 ORDER BY r.rank_change DESC LIMIT 1`).first();
  const topGainer = topGainerResult ? { vtuber: { id: topGainerResult.id, name: topGainerResult.name, slug: topGainerResult.slug }, rank_change: topGainerResult.rank_change } : null;
  const latestUpdateResult = await db.prepare('SELECT recorded_at FROM stats_snapshots ORDER BY recorded_at DESC LIMIT 1').first();
  const latestUpdate = latestUpdateResult?.recorded_at || new Date().toISOString();
  const templateRow = await db.prepare(
    'SELECT setting_value FROM settings WHERE setting_key = ?',
  ).bind('homepage_template').first();
  return c.json({
    total_vtubers: totalVtubers, total_followers_all: totalFollowers, top_gainer: topGainer, latest_update: latestUpdate,
    homepage_template: normalizeHomepageTemplate(templateRow?.setting_value),
    period_choices: [{ value: 'monthly', label: 'รายเดือน' }, { value: 'alltime', label: 'ทั้งหมด' }],
    category_choices: [{ value: 'followers', label: 'ยอดผู้ติดตาม' }, { value: 'views', label: 'ยอดวิว' }, { value: 'videos', label: 'จำนวนคลิป' }],
  });
});

export default api;
