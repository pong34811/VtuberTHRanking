import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendDatabase, mountedRequest, seedChannel, seedUser, staffToken } from '../helpers/backend-sqlite.js';

const stores = [];
const database = () => { const store = backendDatabase(); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const snapshot = recorded_at => ({ followers: 10, total_views: 100, video_count: 1, recorded_at });
const userData = { display_name: 'New User', email: 'new@test.invalid', role: 'staff', status: 'active', password: 'short' };

describe('mounted admin input errors', () => {
  it.each([
    ['POST', '/admin/users', { ...userData, username: 'new-user' }],
    ['PUT', '/admin/users/staff', userData],
  ])('maps invalid passwords to 400 on %s %s without writes', async (method, path, payload) => {
    const store = database();
    seedUser(store); seedUser(store, { id: 'staff', role: 'staff', token: staffToken });
    const oldHash = store.sql.prepare("SELECT password_hash FROM users WHERE id='staff'").get().password_hash;
    const result = await mountedRequest(store, path, { method, authenticated: true, payload });
    expect(result.status).toBe(400);
    expect(result.body.message).toContain('12–128');
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(2);
    expect(store.sql.prepare("SELECT password_hash FROM users WHERE id='staff'").get().password_hash).toBe(oldHash);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n).toBe(0);
  });

  it.each(['2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '2026-04-31T12:00:00+07:00', '2026-01-01T24:00:00Z'])('rejects calendar-invalid snapshot %s instead of silently rolling it over', async recorded => {
    const store = database(); seedUser(store); seedChannel(store);
    const result = await mountedRequest(store, '/admin/vtubers/1/snapshots', { method: 'POST', authenticated: true, payload: snapshot(recorded) });
    expect(result.status).toBe(400);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
  });

  it('accepts a real leap day and normalizes a valid offset timestamp', async () => {
    const store = database(); seedUser(store); seedChannel(store);
    const result = await mountedRequest(store, '/admin/vtubers/1/snapshots', { method: 'POST', authenticated: true, payload: snapshot('2024-02-29T07:30:01.120+07:00') });
    expect(result.status).toBe(201);
    expect(store.sql.prepare('SELECT recorded_at FROM stats_snapshots').get().recorded_at).toBe('2024-02-29T00:30:01.120Z');
  });
});

const youtubeId = `UC${'x'.repeat(22)}`;
const youtubeUrl = `https://www.youtube.com/channel/${youtubeId}`;

it.each(['https://youtube.com/channel/', 'https://m.youtube.com/channel/', 'https://www.youtube.com/@known-creator'])('reuses the daily sync channel identity during manual import from %s', async prefix => {
  const store = database(); seedUser(store); seedChannel(store); youtubeFixture();
  const existingUrl = prefix.includes('@') ? prefix : `${prefix}${youtubeId}/`;
  store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(existingUrl, existingUrl);
  store.sql.prepare('INSERT INTO youtube_profile_state(vtuber_id,channel_id,profile_json,reference_json,source_url,checked_at) VALUES (1,?,?,?,?,datetime(\'now\'))')
    .run(youtubeId, '{}', JSON.stringify({ youtube_url: existingUrl, channel_url: existingUrl }), youtubeUrl);
  const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
  expect(result.status).toBe(200); expect(result.body).toMatchObject({ id: 1, updated: true });
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get()).toEqual({ n: 1 });
  expect(JSON.parse(store.sql.prepare('SELECT profile_json FROM youtube_profile_state').get().profile_json).name).toBe('Imported Channel');
});
function youtubeFixture(statistics = { subscriberCount: '100', viewCount: '1000', videoCount: '10' }) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [{ id: youtubeId,
    snippet: { title: 'Imported Channel', description: 'Fixture', thumbnails: {} },
    statistics,
  }] }), { status: 200 })));
}

it('keeps a newly imported long description equal to its source baseline for later automatic refresh', async () => {
  const store = database(); seedUser(store);
  const description = 'ก'.repeat(4500);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [{ id: youtubeId,
    snippet: { title: '  Long description  ', description, thumbnails: {} },
    statistics: { subscriberCount: '100', viewCount: '1000', videoCount: '10' },
  }] })));
  const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
  expect(result.status).toBe(202);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(0);
  const baseline = JSON.parse(store.sql.prepare('SELECT profile_json FROM directory_candidates').get().profile_json);
  expect(baseline).toMatchObject({ name: 'Long description', bio: description });
});

describe('atomic admin writes with dependent IDs', () => {
  it.each([
    ['/admin/agencies', { name: 'Created Agency' }, 'agencies'],
    ['/admin/vtubers', { name: 'Created Channel', slug: 'created-channel', platform: 'twitch' }, 'vtubers'],
    ['/admin/youtube/import', { input: '@imported' }, 'vtubers'],
    ['/admin/agencies/youtube/import', { input: '@imported' }, 'agencies'],
  ])('rolls back the primary record when the audit fails on %s', async (path, payload, table) => {
    const store = database(); seedUser(store); youtubeFixture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.control.fail = sql => /INSERT INTO audit_logs/.test(sql);
    const result = await mountedRequest(store, path, { method: 'POST', authenticated: true, payload, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(500);
    expect(store.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n).toBe(0);
  });

  it('rolls back snapshot creation and an existing imported channel update on audit failure', async () => {
    const store = database(); seedUser(store); seedChannel(store); youtubeFixture();
    store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(youtubeUrl, youtubeUrl);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.control.fail = sql => /INSERT INTO audit_logs/.test(sql);
    for (const [path, payload] of [['/admin/vtubers/1/snapshots', snapshot('2026-09-01T12:00:00Z')], ['/admin/youtube/import', { input: '@imported' }]]) {
      expect((await mountedRequest(store, path, { method: 'POST', authenticated: true, payload, env: { YOUTUBE_API_KEY: 'fixture-only' } })).status).toBe(500);
      expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
      expect(store.sql.prepare('SELECT name FROM vtubers WHERE id=1').get().name).toBe('Alpha');
    }
  });

  it('retries a failed import without orphaned or duplicate channels and records the exact dependent IDs', async () => {
    const store = database(); seedUser(store); youtubeFixture();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.control.fail = sql => /INSERT INTO audit_logs/.test(sql);
    const request = () => mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect((await request()).status).toBe(500);
    store.control.fail = null;
    const retry = await request();
    expect(retry.status).toBe(202);
    const refresh = await request();
    expect(refresh.status).toBe(202);
    expect(refresh.body.channel_id).toBe(retry.body.channel_id);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM directory_candidates').get().n).toBe(1);
    expect(store.sql.prepare('SELECT DISTINCT target_id FROM audit_logs').all()).toEqual([{ target_id: youtubeId }]);
  });

  it('rechecks the import natural key inside the same batch when another request wins allocation', async () => {
    const store = database(); seedUser(store); youtubeFixture();
    store.control.beforeBatch = () => {
      store.control.beforeBatch = null;
      store.sql.prepare("INSERT INTO vtubers(id,name,slug,channel_url,youtube_url) VALUES (71,'Concurrent','concurrent',?,?)").run(youtubeUrl, youtubeUrl);
    };
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(409);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(1);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n).toBe(0);
  });
});

describe('mounted import resource and protocol boundaries', () => {
  it.each(['subscriberCount', 'viewCount', 'videoCount'])('returns 502 for a malformed JSON counter in %s without persistence', async field => {
    const store = database(); seedUser(store); seedChannel(store);
    store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(youtubeUrl, youtubeUrl);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    youtubeFixture({ subscriberCount: '100', viewCount: '1000', videoCount: '10', [field]: { toString: 'bad' } });
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(502);
    expect(result.body.message).toBe('YouTube returned invalid statistics');
    for (const table of ['stats_snapshots', 'audit_logs']) {
      expect(store.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n).toBe(0);
    }
  });

  it.each([0, '0'])('persists genuine zero counters from YouTube (%j)', async zero => {
    const store = database(); seedUser(store); seedChannel(store);
    store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(youtubeUrl, youtubeUrl);
    youtubeFixture({ hiddenSubscriberCount: false, subscriberCount: zero, viewCount: zero, videoCount: zero });
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ followers: 0, total_views: 0, video_count: 0 });
    expect(store.sql.prepare('SELECT followers,total_views,video_count FROM stats_snapshots').get()).toEqual({ followers: 0, total_views: 0, video_count: 0 });
  });

  it.each(['subscriberCount', 'viewCount', 'videoCount'].flatMap(field => [undefined, null].map(value => [field, value])))('rejects incomplete %s=%s without replacing an existing channel or writing a zero snapshot', async (field, value) => {
    const store = database(); seedUser(store); seedChannel(store);
    store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(youtubeUrl, youtubeUrl);
    const before = store.sql.prepare('SELECT * FROM vtubers').all();
    youtubeFixture({ subscriberCount: '100', viewCount: '1000', videoCount: '10', [field]: value });
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(502);
    expect(result.body.message).toBe('YouTube returned incomplete statistics');
    expect(store.sql.prepare('SELECT * FROM vtubers').all()).toEqual(before);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n).toBe(0);
  });

  it.each([false, true])('rejects hidden subscriber counts without changing channel or snapshot data (existing: %s)', async existing => {
    const store = database(); seedUser(store);
    if (existing) {
      seedChannel(store);
      store.sql.prepare('UPDATE vtubers SET channel_url=?,youtube_url=? WHERE id=1').run(youtubeUrl, youtubeUrl);
    }
    const before = store.sql.prepare('SELECT * FROM vtubers').all();
    youtubeFixture({ hiddenSubscriberCount: true, subscriberCount: '100', viewCount: '1000', videoCount: '10' });
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(existing ? 502 : 202);
    if (existing) expect(result.body.message).toBe('YouTube subscriber count is hidden');
    expect(store.sql.prepare('SELECT * FROM vtubers').all()).toEqual(before);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n).toBe(existing ? 0 : 1);
  });

  it.each(['/admin/youtube/import', '/admin/agencies/youtube/import'])('caps %s at 8192 UTF-8 bytes before outbound fetch', async path => {
    const store = database(); seedUser(store); youtubeFixture();
    const result = await mountedRequest(store, path, { method: 'POST', authenticated: true, payload: { input: 'ก'.repeat(3000) }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(413);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('maps invalid upstream JSON to a 502 protocol error without persistence', async () => {
    const store = database(); seedUser(store);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>provider outage</html>', { status: 200 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(502);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(0);
  });

  it('never logs raw Admin provider errors, credentialed URLs or payloads', async () => {
    const store = database(); seedUser(store);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://provider.invalid/?key=private-key password=secret-body')));
    const result = await mountedRequest(store, '/admin/youtube/import', { method: 'POST', authenticated: true, payload: { input: '@imported' }, env: { YOUTUBE_API_KEY: 'fixture-only' } });
    expect(result.status).toBe(502);
    const logged = log.mock.calls.flat().map(value => value instanceof Error ? `${value.message} ${value.stack}` : JSON.stringify(value)).join(' ');
    expect(logged).not.toContain('private-key');
    expect(logged).not.toContain('secret-body');
    expect(JSON.stringify(result.body)).not.toContain('private-key');
  });
});
