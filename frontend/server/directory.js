import { Hono } from 'hono';
import { DIRECTORY_AFFILIATIONS, DIRECTORY_CATEGORIES } from '../../shared/directory.js';
import { pageInteger } from './pagination.js';

const api = new Hono();

api.get('/', async c => {
  const db = c.env.DB;
  if (!db) return c.json({ error: 'DB not available' }, 500);

  const q = (c.req.query('q') || '').trim();
  const category = c.req.query('category') || '';
  const affiliation = c.req.query('affiliation') || '';
  if ((category && !DIRECTORY_CATEGORIES.includes(category)) || (affiliation && !DIRECTORY_AFFILIATIONS.includes(affiliation))) {
    return c.json({ error: true, status: 400, message: 'Invalid directory filter' }, 400);
  }

  const limit = pageInteger(c.req.query('limit'), 12, 1, 100);
  const offset = pageInteger(c.req.query('offset'), 0, 0);
  const clauses = ['v.is_active = 1'];
  const values = [];
  if (q) {
    clauses.push('v.name LIKE ?');
    values.push(`%${q}%`);
  }
  if (category) {
    clauses.push('v.category = ?');
    values.push(category);
  }
  if (affiliation) {
    clauses.push('v.affiliation = ?');
    values.push(affiliation);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
  const createdAt = "CASE WHEN date(substr(v.created_at, 1, 10), '+0 days') = substr(v.created_at, 1, 10) AND substr(v.created_at, 12, 2) BETWEEN '00' AND '23' THEN datetime(v.created_at) END";
  const order = c.req.query('sort') === 'created_at_desc'
    ? `CASE WHEN (${createdAt}) IS NULL THEN 1 ELSE 0 END ASC, (${createdAt}) DESC, v.name COLLATE NOCASE ASC, v.id ASC`
    : 'v.name COLLATE NOCASE ASC, v.id ASC';

  const totalRow = await db.prepare(`SELECT COUNT(*) AS total FROM vtubers v ${where}`).bind(...values).first();
  const { results: rows } = await db.prepare(
    `SELECT v.id, v.name, v.slug, v.avatar, v.category, v.affiliation, v.agency_name, v.created_at FROM vtubers v ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
  ).bind(...values, limit, offset).all();
  const { results: categoryCounts } = await db.prepare(
    'SELECT category, COUNT(*) AS count FROM vtubers WHERE is_active = 1 GROUP BY category ORDER BY category',
  ).all();

  const fields = ['id', 'name', 'slug', 'avatar', 'category', 'affiliation', 'agency_name', 'created_at'];
  const directoryRows = rows.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])));
  return c.json({
    total: totalRow?.total || 0,
    count: directoryRows.length,
    limit,
    offset,
    results: directoryRows,
    category_counts: categoryCounts,
  });
});

export default api;
