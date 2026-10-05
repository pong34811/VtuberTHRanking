import { readFileSync, readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mountedRequest, managerToken, csrfToken } from '../helpers/backend-sqlite.js';
import { DUMMY_PASSWORD_HASH } from '../../server/password.js';
import { updateAll } from '../../../worker/updater.js';

let runtime;
afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); await runtime?.dispose(); runtime = null; });
async function database() {
  const scratch = process.env.TMPDIR || tmpdir();
  runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, name: 'backend-d1-test',
    script: 'export default { fetch() { return new Response("backend D1 test"); } };',
    compatibilityDate: '2026-09-15', cf: false,
    rootPath: scratch, resourceTmpPath: `${scratch}/backend-d1-${randomUUID()}`,
    d1Databases: { DB: 'backend-test' }, d1Persist: false,
  }));
  const db = await runtime.getD1Database('DB');
  const directory = new URL('../../migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
    const statements = readFileSync(new URL(file, directory), 'utf8')
      .replace(/\bBEGIN TRANSACTION\s*;/gi, '').replace(/\bCOMMIT\s*;/gi, '')
      .replace(/^\s*--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
  const time = Math.floor(Date.now() / 1000);
  await db.batch([
    db.prepare('INSERT INTO users(id,username,password_hash,display_name,email,role,status) VALUES (?,?,?,?,?,?,?)').bind('manager', 'manager', DUMMY_PASSWORD_HASH, 'Manager', 'manager@test.invalid', 'manager', 'active'),
    db.prepare('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES (?,?,?,?,?)').bind(createHash('sha256').update(managerToken).digest('hex'), 'manager', csrfToken, time + 28800, time),
    db.prepare('INSERT INTO bootstrap_lock(id) VALUES (1)'),
  ]);
  return { db };
}
const youtubeId = `UC${'x'.repeat(22)}`;
function youtubeFixture(statistics = { subscriberCount: '10', viewCount: '100', videoCount: '1' }) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [{ id: youtubeId,
    snippet: { title: 'Imported', description: 'Fixture', thumbnails: {} },
    statistics,
  }] }), { status: 200 })));
}

it('rolls back the entire mutation class and resolves correct audit IDs on actual D1', async () => {
  const store = await database();
  youtubeFixture();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await store.db.prepare("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'injected audit failure'); END").run();
  for (const [path, payload, table] of [
    ['/admin/agencies', { name: 'Agency' }, 'agencies'],
    ['/admin/vtubers', { name: 'Creator', slug: 'creator' }, 'vtubers'],
    ['/admin/agencies/youtube/import', { input: '@imported' }, 'agencies'],
    ['/admin/youtube/import', { input: '@imported' }, 'vtubers'],
  ]) {
    const result = await mountedRequest(store, path, { method: 'POST', authenticated: true, payload, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status, path).toBe(500);
    expect(await store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).toEqual({ n: 0 });
    expect(await store.db.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').first()).toEqual({ n: 0 });
  }
  expect(log).toHaveBeenCalled();
  await store.db.prepare('DROP TRIGGER reject_audit').run();
  for (const [path, payload, table, type] of [
    ['/admin/agencies', { name: 'Agency' }, 'agencies', 'agency'],
    ['/admin/vtubers', { name: 'Creator', slug: 'creator' }, 'vtubers', 'vtuber'],
  ]) {
    const result = await mountedRequest(store, path, { method: 'POST', authenticated: true, payload });
    expect(result.status).toBe(201);
    expect(await store.db.prepare(`SELECT id FROM ${table} WHERE id=?`).bind(result.body.id).first()).toEqual({ id: result.body.id });
    expect(await store.db.prepare('SELECT target_id FROM audit_logs WHERE target_type=?').bind(type).first()).toEqual({ target_id: String(result.body.id) });
  }
}, 30_000);

it('serializes concurrent natural-key imports without duplicate channels on actual D1', async () => {
  const store = await database(); youtubeFixture();
  const request = () => mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
  const responses = await Promise.all([request(), request()]);
  expect(responses.map(row => row.status).sort()).toEqual([200, 201]);
  expect(responses[0].body.id).toBe(responses[1].body.id);
  expect(await store.db.prepare('SELECT COUNT(*) AS n FROM vtubers').first()).toEqual({ n: 1 });
  expect((await store.db.prepare('SELECT DISTINCT vtuber_id FROM stats_snapshots').all()).results).toEqual([{ vtuber_id: responses[0].body.id }]);
  expect((await store.db.prepare('SELECT DISTINCT target_id FROM audit_logs').all()).results).toEqual([{ target_id: String(responses[0].body.id) }]);
  expect((await store.db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}, 30_000);

it('validates IDs and rolls up chronological Bangkok days through mounted APIs on actual D1', async () => {
  const store = await database();
  await store.db.batch([
    store.db.prepare("INSERT INTO vtubers(id,name,slug,channel_url) VALUES (1,'Alpha','alpha','https://youtube.com/@alpha')"),
    store.db.prepare("INSERT INTO vtubers(id,name,slug,channel_url) VALUES (2,'Beta','beta','https://youtube.com/@beta')"),
    store.db.prepare("INSERT INTO stats_snapshots(vtuber_id,followers,recorded_at) VALUES (1,10,'2026-09-01T16:59:59Z')"),
    store.db.prepare("INSERT INTO stats_snapshots(vtuber_id,followers,recorded_at) VALUES (1,20,'2026-09-01T18:00:00Z')"),
    store.db.prepare("INSERT INTO stats_snapshots(vtuber_id,followers,recorded_at) VALUES (1,30,'2026-09-01 19:00:00')"),
  ]);
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-05T00:00:00Z'));
  const invalid = await mountedRequest(store, '/compare/', { method: 'POST', payload: { vtubers: [{ id: 1 }, 2] } });
  expect(invalid.status).toBe(400);
  const profile = await mountedRequest(store, '/vtubers/alpha/');
  expect(profile.body.latest_stats).toMatchObject({ followers: 30, recorded_at: '2026-09-01T19:00:00.000Z' });
  const history = await mountedRequest(store, '/vtubers/alpha/history/?limit=1&offset=1');
  expect(history.status).toBe(200);
  expect(history.body).toMatchObject({ total: 2, count: 1, timezone: 'Asia/Bangkok', granularity: 'day', history: [{ date: '2026-09-02', followers: 30 }] });
  expect((await mountedRequest(store, '/directory/')).status).toBe(200);
}, 30_000);

it('blocks unavailable counters in both ingestion paths and accepts real zero on actual D1', async () => {
  const store = await database();
  const youtubeUrl = `https://www.youtube.com/channel/${youtubeId}`;
  await store.db.prepare("INSERT INTO vtubers(id,name,slug,channel_url,youtube_url) VALUES (1,'Existing','existing',?,?)").bind(youtubeUrl, youtubeUrl).run();
  const request = () => mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
  const collect = () => updateAll({ DB: store.db, YOUTUBE_API_KEY: 'fixture-only' }, true, { triggerSource: 'manual' });
  for (const [statistics, reason] of [
    [{ hiddenSubscriberCount: true, viewCount: '100', videoCount: '1' }, 'YouTube subscriber count is hidden'],
    [{ viewCount: '100', videoCount: '1' }, 'YouTube returned incomplete statistics'],
    [{ subscriberCount: '10', videoCount: '1' }, 'YouTube returned incomplete statistics'],
    [{ subscriberCount: true, viewCount: '100', videoCount: '1' }, 'YouTube returned invalid statistics'],
    [{ subscriberCount: { toString: 'bad' }, viewCount: '100', videoCount: '1' }, 'YouTube returned invalid statistics'],
    [null, 'YouTube returned no channel statistics'],
  ]) {
    youtubeFixture(statistics);
    const response = await request();
    expect(response.status).toBe(502);
    expect(response.body.message).toBe(reason);
    await expect(collect()).resolves.toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0,
      errors: [{ vtuber_id: 1, reason }] });
    expect(await store.db.prepare('SELECT name FROM vtubers WHERE id=1').first()).toEqual({ name: 'Existing' });
    for (const table of ['stats_snapshots', 'ranking_pipeline_snapshots', 'rankings', 'audit_logs']) {
      expect(await store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).toEqual({ n: 0 });
    }
  }
  youtubeFixture({ hiddenSubscriberCount: false, subscriberCount: '0', viewCount: '0', videoCount: '0' });
  expect((await request()).status).toBe(200);
  await expect(collect()).resolves.toMatchObject({ ok: true, status: 'succeeded', updated: 1, rankingsPublished: 6 });
  expect((await store.db.prepare('SELECT followers,total_views,video_count FROM stats_snapshots').all()).results)
    .toEqual([{ followers: 0, total_views: 0, video_count: 0 }, { followers: 0, total_views: 0, video_count: 0 }]);
  expect((await store.db.prepare('SELECT DISTINCT score FROM rankings').all()).results).toEqual([{ score: 0 }]);
}, 30_000);

it('persists introduction configuration and audits it through mounted APIs on actual D1', async () => {
  const store = await database();
  const path = '/admin/settings/intro-homepage-template';
  expect((await mountedRequest(store, '/intro-homepage-config/')).body.template).toBe('sculpture-index-3d');
  const result = await mountedRequest(store, path, { method: 'PUT', authenticated: true, payload: { intro_homepage_template: 'neon-portal-3d' } });
  expect(result.status).toBe(200);
  expect((await mountedRequest(store, '/intro-homepage-config/')).body).toEqual({ template: 'neon-portal-3d' });
  expect(await store.db.prepare("SELECT setting_value FROM settings WHERE setting_key='intro_homepage_template'").first()).toEqual({ setting_value: 'neon-portal-3d' });
  expect(await store.db.prepare("SELECT target_id FROM audit_logs WHERE target_id='intro_homepage_template'").first()).toEqual({ target_id: 'intro_homepage_template' });
}, 30_000);
