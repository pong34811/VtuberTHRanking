import { Hono } from 'hono';

import { normalizeHomepageTemplate } from '../../shared/homepage-templates.js';
import { normalizeIntroHomepageTemplate } from '../../shared/intro-homepage-templates.js';
import { DIRECTORY_AFFILIATIONS } from '../../shared/directory.js';
import directoryApi from './directory.js';
import { pageInteger } from './pagination.js';
import { HTTPException } from 'hono/http-exception';
import { readJsonObject } from './request-body.js';
import { requestSiteConfig, readCategoryChoices, selectedRankingMonth, validRankingMonth } from './site-config.js';
import { latestSnapshotOrder, rankingEligibility } from '../../shared/snapshot-policy.js';
import { publicTimestamp } from './request-validation.js';

const api = new Hono();

api.get('/', (c) => c.json({ status: 'ok', service: 'VTuber Thai Ranking API' }));
api.use('*', async (c, next) => {
  const path = c.req.path.replace(/^\/api\/v1(?=\/|$)/, '') || '/';
  if (path === '/') return next();
  const config = await requestSiteConfig(c);
  if (path !== '/site-config/' && config.site_status === 'maintenance') {
    c.header('Cache-Control', 'no-store');
    c.header('Retry-After', '300');
    return c.json({ error: true, status: 503, message: 'Site is under maintenance', site_status: config.site_status, site_name: config.site_name }, 503);
  }
  return next();
});
api.get('/site-config/', async c => {
  c.header('Cache-Control', 'no-store');
  return c.json({ ...await requestSiteConfig(c), category_choices: await readCategoryChoices(c.env.DB) });
});
api.route('/directory/', directoryApi);

api.get('/homepage-config/', async c => {
  if (!c.env.DB) return c.json({ error: 'DB not available' }, 500);
  const row = await c.env.DB.prepare('SELECT setting_value FROM settings WHERE setting_key = ?').bind('homepage_template').first();
  c.header('Cache-Control', 'no-store');
  return c.json({ template: normalizeHomepageTemplate(row?.setting_value) });
});

api.get('/intro-homepage-config/', async c => {
  c.header('Cache-Control', 'no-store');
  if (!c.env.DB) return c.json({ error: 'DB not available' }, 500);
  const row = await c.env.DB.prepare('SELECT setting_value FROM settings WHERE setting_key = ?').bind('intro_homepage_template').first();
  return c.json({ template: normalizeIntroHomepageTemplate(row?.setting_value) });
});

api.get('/rankings/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  let period = c.req.query('period') || 'monthly';
  let category = c.req.query('category') || 'followers';
  const affiliation = c.req.query('affiliation') || '';
  if (affiliation && !DIRECTORY_AFFILIATIONS.includes(affiliation)) {
    return c.json({ error: true, status: 400, message: 'Invalid ranking affiliation' }, 400);
  }

  const limit = pageInteger(c.req.query('limit'), 50, 1, 100);
  const offset = pageInteger(c.req.query('offset'), 0, 0);

  if (!['monthly', 'alltime'].includes(period)) period = 'monthly';
  if (!['followers', 'views', 'videos'].includes(category)) category = 'followers';
  const categoryChoices = await readCategoryChoices(db);
  if (!c.req.query('category') && !categoryChoices.some(row => row.value === category)) category = categoryChoices[0]?.value || category;
  if (!categoryChoices.some(row => row.value === category)) return c.json({ error: true, status: 400, message: 'Ranking category is inactive' }, 400);

  let monthDate = null;
  if (period !== 'alltime') {
    monthDate = `${await selectedRankingMonth(c)}-01`;
  }

  let whereClause = `WHERE ${rankingEligibility('v')} AND r.status = 'active' AND r.period = ? AND r.category = ?`;
  const params = [period, category];

  if (period === 'alltime') {
    whereClause += ' AND r.month IS NULL';
  } else {
    whereClause += ' AND r.month = ?';
    params.push(monthDate);
  }
  if (affiliation) {
    whereClause += ' AND v.affiliation = ?';
    params.push(affiliation);
  }

  const countResult = await db.prepare(
    `SELECT COUNT(*) as total FROM rankings r JOIN vtubers v ON r.vtuber_id = v.id ${whereClause}`
  ).bind(...params).first();
  const total = countResult?.total || 0;

  const rankExpression = affiliation ? 'RANK() OVER (ORDER BY r.score DESC)' : 'r.rank';
  const query = `SELECT ${rankExpression} AS rank, r.rank AS overall_rank, r.score, r.rank_change, r.video_count, v.id, v.name, v.slug, v.avatar, v.category as vtuber_category, v.affiliation
    FROM rankings r JOIN vtubers v ON r.vtuber_id = v.id ${whereClause} ORDER BY r.rank ASC, r.vtuber_id ASC LIMIT ? OFFSET ?`;

  const { results } = await db.prepare(query).bind(...params, limit, offset).all();

  const pageLink = (pageOffset) => {
    const query = new URLSearchParams({ period, category, limit: String(limit), offset: String(pageOffset) });
    if (monthDate) query.set('month', monthDate.slice(0, 7));
    if (affiliation) query.set('affiliation', affiliation);
    return `/api/v1/rankings/?${query}`;
  };

  return c.json({
    period, category,
    ...(affiliation && { affiliation }),
    month: monthDate ? monthDate.slice(0, 7) : null,
    total, count: results.length,
    next: offset + limit < total ? pageLink(offset + limit) : null,
    previous: offset > 0 ? pageLink(Math.max(0, offset - limit)) : null,
    results: results.map(row => ({
      rank: row.rank,
      ...(affiliation && { overall_rank: row.overall_rank }),
      vtuber: { id: row.id, name: row.name, slug: row.slug, avatar: row.avatar, category: row.vtuber_category, affiliation: row.affiliation, video_count: row.video_count },
      score: row.score, rank_change: affiliation ? null : row.rank_change,
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
    ORDER BY ${latestSnapshotOrder('s')} LIMIT 1
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
  const rankingMonth = await selectedRankingMonth(c);
  const { results: rankResults } = await db.prepare(`SELECT r.period, r.category, r.rank FROM rankings r JOIN vtubers v ON v.id=r.vtuber_id
    WHERE vtuber_id = ? AND r.status = 'active' AND ${rankingEligibility('v')}
    AND EXISTS (SELECT 1 FROM categories category WHERE category.id=r.category AND category.status='active')
    AND ((period = 'monthly' AND month = ?) OR (period = 'alltime' AND month IS NULL))
    ORDER BY r.period, r.category`).bind(vtuber.id, `${rankingMonth}-01`).all();
  const currentRank = {};
  for (const r of rankResults) currentRank[`${r.period}_${r.category}`] = r.rank;
  const latestStats = await db.prepare(`SELECT s.followers, s.total_views, s.avg_views, s.video_count, s.recorded_at FROM stats_snapshots s WHERE s.vtuber_id = ? ORDER BY ${latestSnapshotOrder('s')} LIMIT 1`).bind(vtuber.id).first();
  const { notes: _internalNotes, ...publicVtuber } = vtuber;
  return c.json({ ...publicVtuber, current_rank: currentRank, latest_stats: latestStats ? { ...latestStats, recorded_at: publicTimestamp(latestStats.recorded_at) } : null, ranking_month: rankingMonth, category_choices: await readCategoryChoices(db) });
});

function historyMonths(raw = 6) {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^-?\d+$/.test(raw))) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? Math.min(12, Math.max(1, value)) : null;
}

const HISTORY_TIMEZONE = 'Asia/Bangkok';
const HISTORY_LIMIT = 400;
function historyRange(months) {
  const bangkok = new Date(Date.now() + 7 * 3600000);
  const start = new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth() - months, 1));
  return { start: start.toISOString().slice(0, 10), end: bangkok.toISOString().slice(0, 10) };
}
async function dailyHistory(db, id, { months, limit, offset }, columns) {
  const { start, end } = historyRange(months);
  const predicate = "s.vtuber_id = ? AND date(s.recorded_at, '+7 hours') BETWEEN ? AND ?";
  const countRow = await db.prepare(`SELECT COUNT(DISTINCT date(s.recorded_at, '+7 hours')) AS total FROM stats_snapshots s WHERE ${predicate}`).bind(id, start, end).first();
  const { results } = await db.prepare(`WITH daily AS (
    SELECT s.*, date(s.recorded_at, '+7 hours') AS date,
      ROW_NUMBER() OVER (PARTITION BY date(s.recorded_at, '+7 hours') ORDER BY ${latestSnapshotOrder('s')}) AS day_rank
    FROM stats_snapshots s WHERE ${predicate}
  ) SELECT date, recorded_at, ${columns} FROM daily WHERE day_rank = 1 ORDER BY date ASC LIMIT ? OFFSET ?`).bind(id, start, end, limit, offset).all();
  return { history: results.map(row => ({ ...row, recorded_at: publicTimestamp(row.recorded_at) })), total: countRow?.total ?? 0, count: results.length };
}
function historyPagination(path, values, total, limit, offset) {
  const link = nextOffset => `${path}?${new URLSearchParams({ ...values, limit: String(limit), offset: String(nextOffset) })}`;
  return {
    limit, offset,
    next: offset + limit < total ? link(offset + limit) : null,
    previous: offset > 0 ? link(Math.max(0, offset - limit)) : null,
  };
}

api.get('/vtubers/:slug/history/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const slug = c.req.param('slug');
  const months = historyMonths(c.req.query('months') || '6');
  if (months === null) return c.json({ error: true, status: 400, message: 'months must be an integer' }, 400);
  const vtuber = await db.prepare(`SELECT id, name, slug FROM vtubers WHERE slug = ? AND is_active = 1`).bind(slug).first();
  if (!vtuber) return c.json({ error: true, status: 404, message: 'VTuber not found' }, 404);
  const limit = pageInteger(c.req.query('limit'), HISTORY_LIMIT, 1, HISTORY_LIMIT);
  const offset = pageInteger(c.req.query('offset'), 0, 0, HISTORY_LIMIT);
  const data = await dailyHistory(db, vtuber.id, { months, limit, offset }, 'followers, total_views, avg_views, video_count');
  return c.json({ vtuber, ...data, timezone: HISTORY_TIMEZONE, granularity: 'day',
    ...historyPagination(`/api/v1/vtubers/${encodeURIComponent(slug)}/history/`, { months: String(months) }, data.total, limit, offset),
  });
});

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
api.post('/compare/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  let body;
  try { body = await readJsonObject(c); }
  catch (error) {
    const status = error instanceof HTTPException ? error.status : 400;
    return c.json({ error: true, status, message: error instanceof HTTPException ? error.message : 'Invalid JSON' }, status);
  }
  const { vtubers, category = 'followers' } = body;
  const months = historyMonths(body.months);
  if (months === null) return c.json({ error: true, status: 400, message: 'months must be an integer' }, 400);
  if (!Array.isArray(vtubers) || vtubers.length < 2 || vtubers.length > 5) return c.json({ error: true, status: 400, message: 'vtubers must be 2-5 IDs' }, 400);
  if (vtubers.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(vtubers).size !== vtubers.length) return c.json({ error: true, status: 400, message: 'vtubers must be distinct positive safe-integer IDs' }, 400);
  if (!['followers', 'views', 'videos'].includes(category)) return c.json({ error: true, status: 400, message: 'Invalid category' }, 400);
  if (!(await readCategoryChoices(db)).some(row => row.value === category)) return c.json({ error: true, status: 400, message: 'Ranking category is inactive' }, 400);
  const limit = pageInteger(c.req.query('limit') ?? body.limit, HISTORY_LIMIT, 1, HISTORY_LIMIT);
  const offset = pageInteger(c.req.query('offset') ?? body.offset, 0, 0, HISTORY_LIMIT);
  const results = [];
  for (let i = 0; i < vtubers.length; i++) {
    const vtuber = await db.prepare(`SELECT id, name, slug FROM vtubers WHERE id = ? AND is_active = 1`).bind(vtubers[i]).first();
    if (!vtuber) continue;
    const column = category === 'followers' ? 'followers' : category === 'videos' ? 'video_count' : 'total_views';
    const data = await dailyHistory(db, vtuber.id, { months, limit, offset }, `${column} AS value`);
    results.push({ ...vtuber, color: COLORS[i % COLORS.length], ...data });
  }
  const largestSeries = Math.max(0, ...results.map(row => row.total));
  return c.json({ category, vtubers: results, timezone: HISTORY_TIMEZONE, granularity: 'day',
    total: results.reduce((sum, row) => sum + row.total, 0), count: results.reduce((sum, row) => sum + row.count, 0),
    ...historyPagination('/api/v1/compare/', { vtubers: vtubers.join(','), category, months: String(months) }, largestSeries, limit, offset),
  });
});

api.get('/summary/', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);
  const config = await requestSiteConfig(c);
  const rankingMonth = await selectedRankingMonth(c);
  const totalResult = await db.prepare('SELECT COUNT(*) as count FROM vtubers WHERE is_active = 1').first();
  const totalVtubers = totalResult?.count || 0;
  const followersResult = await db.prepare(`SELECT SUM(latest.followers) as total FROM vtubers v LEFT JOIN stats_snapshots latest ON latest.id = (
    SELECT s.id FROM stats_snapshots s WHERE s.vtuber_id = v.id ORDER BY ${latestSnapshotOrder('s')} LIMIT 1
  ) WHERE v.is_active = 1`).first();
  const totalFollowers = followersResult?.total ?? 0;
  const topGainerResult = await db.prepare(`SELECT v.id, v.name, v.slug, r.rank_change FROM rankings r JOIN vtubers v ON r.vtuber_id = v.id
    JOIN categories category ON category.id=r.category AND category.status='active'
    WHERE ${rankingEligibility('v')} AND r.status = 'active' AND r.period = 'monthly' AND r.month = ? AND r.category = 'followers' AND r.rank_change > 0
    ORDER BY r.rank_change DESC, r.rank ASC, r.vtuber_id ASC LIMIT 1`).bind(`${rankingMonth}-01`).first();
  const topGainer = topGainerResult ? { vtuber: { id: topGainerResult.id, name: topGainerResult.name, slug: topGainerResult.slug }, rank_change: topGainerResult.rank_change } : null;
  const lastCollected = await db.prepare(`SELECT s.recorded_at FROM stats_snapshots s JOIN vtubers v ON v.id = s.vtuber_id WHERE v.is_active = 1 ORDER BY ${latestSnapshotOrder('s')} LIMIT 1`).first();
  const lastPublished = await db.prepare("SELECT completed_at FROM ranking_pipeline_runs WHERE status='succeeded' AND completed_at IS NOT NULL ORDER BY julianday(completed_at) DESC,id DESC LIMIT 1").first();
  const { results: months } = await db.prepare(`SELECT DISTINCT substr(r.month,1,7) AS month FROM rankings r JOIN vtubers v ON v.id=r.vtuber_id
    JOIN categories category ON category.id=r.category AND category.status='active'
    WHERE ${rankingEligibility('v')} AND r.status='active' AND r.period='monthly' AND r.month IS NOT NULL ORDER BY month DESC`).all();
  const lastPublishedAt = publicTimestamp(lastPublished?.completed_at);
  return c.json({
    total_vtubers: totalVtubers, total_followers_all: totalFollowers, top_gainer: topGainer, latest_update: lastPublishedAt,
    last_collected_at: publicTimestamp(lastCollected?.recorded_at), last_published_at: lastPublishedAt,
    ranking_month: rankingMonth, available_months: months.map(row => row.month).filter(validRankingMonth),
    site_name: config.site_name, site_status: config.site_status,
    period_choices: [{ value: 'monthly', label: 'รายเดือน' }, { value: 'alltime', label: 'ทั้งหมด' }],
    category_choices: await readCategoryChoices(db),
  });
});

export default api;
