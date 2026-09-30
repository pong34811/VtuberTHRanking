import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { onRequest } from '../../functions/api/[[path]].js';
import { DUMMY_PASSWORD_HASH } from '../../server/password.js';

// Real SQL and sequential transaction semantics, not a queued response mock.
export function backendDatabase() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const directory = new URL('../../migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    sql.exec(readFileSync(new URL(file, directory), 'utf8'));
  }
  const calls = [];
  const control = { fail: null, beforeBatch: null };
  function prepare(query) {
    let values = [];
    const execute = operation => {
      calls.push({ sql: query, values: [...values], operation });
      if (control.fail?.(query, values)) throw new Error('Injected database failure');
      const native = sql.prepare(query);
      if (operation === 'first') return native.get(...values) ?? null;
      if (operation === 'all') return { results: native.all(...values) };
      const results = native.columns().length ? native.all(...values) : [];
      const meta = native.columns().length ? sql.prepare('SELECT last_insert_rowid() AS id, changes() AS n').get() : native.run(...values);
      return { success: true, results, meta: { last_row_id: Number(meta.lastInsertRowid ?? meta.id), changes: Number(meta.changes ?? meta.n) } };
    };
    const statement = {
      bind(...next) { values = next; return statement; },
      async first() { return execute('first'); },
      async all() { return execute('all'); },
      async run() { return execute('run'); },
    };
    return statement;
  }
  const db = {
    prepare,
    async batch(statements) {
      await control.beforeBatch?.();
      sql.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sql, db, calls, control, close: () => sql.close() };
}

export const managerToken = 'a'.repeat(64);
export const staffToken = 'c'.repeat(64);
export const csrfToken = 'b'.repeat(64);
export function seedUser(store, { id = 'manager', role = 'manager', token = managerToken, hash = DUMMY_PASSWORD_HASH, expiresAt = Math.floor(Date.now() / 1000) + 28800 } = {}) {
  store.sql.prepare('INSERT INTO users(id,username,password_hash,display_name,email,role,status) VALUES (?,?,?,?,?,?,?)')
    .run(id, id, hash, id, `${id}@test.invalid`, role, 'active');
  store.sql.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), id, csrfToken, expiresAt, Math.floor(Date.now() / 1000));
  store.sql.exec('INSERT OR IGNORE INTO bootstrap_lock(id) VALUES (1)');
}
export function seedChannel(store, id = 1, name = 'Alpha', { active = 1, platform = 'youtube' } = {}) {
  store.sql.prepare('INSERT INTO vtubers(id,name,slug,channel_url,is_active,platform) VALUES (?,?,?,?,?,?)')
    .run(id, name, name.toLowerCase(), `https://www.youtube.com/@${name}`, active, platform);
}
export function addSnapshot(store, id, followers, recordedAt, videos = 10, views = 1000) {
  store.sql.prepare('INSERT INTO stats_snapshots(vtuber_id,followers,total_views,video_count,recorded_at) VALUES (?,?,?,?,?)')
    .run(id, followers, views, videos, recordedAt);
}
export async function mountedRequest(store, path, { method = 'GET', payload, rawBody, headers = {}, authenticated = false, token = managerToken, origin = 'https://test.invalid', host = 'test.invalid', env = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (authenticated) requestHeaders.set('Cookie', `__Host-vt_admin=${token}`);
  if (method !== 'GET' && method !== 'HEAD') {
    if (!requestHeaders.has('Origin')) requestHeaders.set('Origin', origin);
    if (authenticated && !requestHeaders.has('X-CSRF-Token')) requestHeaders.set('X-CSRF-Token', csrfToken);
    if (!requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  }
  const response = await onRequest({
    request: new Request(`https://${host}/api/v1${path}`, {
      method, headers: requestHeaders, body: rawBody ?? (payload === undefined ? undefined : JSON.stringify(payload)),
      ...(rawBody instanceof ReadableStream ? { duplex: 'half' } : {}),
    }),
    env: { DB: store?.db, ...env },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, status: response.status, body, headers: response.headers };
}
