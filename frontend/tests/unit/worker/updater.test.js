import { afterEach, describe, expect, it, vi } from 'vitest';
import { timingSafeEqual } from 'node:crypto';
import { createSqliteD1 } from '../../helpers/sqlite-d1.js';

import updater, { updateAll } from '../../../../worker/updater.js';

const channelId = suffix => `UC${String(suffix).repeat(22).slice(0, 22)}`;
const databases = [];

function stubWorkerCrypto() {
  const nativeCrypto = globalThis.crypto;
  vi.stubGlobal('crypto', {
    randomUUID: nativeCrypto.randomUUID.bind(nativeCrypto),
    subtle: {
      digest: nativeCrypto.subtle.digest.bind(nativeCrypto.subtle),
      timingSafeEqual: (left, right) => timingSafeEqual(Buffer.from(left), Buffer.from(right)),
    },
  });
}

function pipelineDb({
  frequency = 'manual',
  lastSuccess = null,
  latestRun = null,
  channels = [],
} = {}) {
  const database = createSqliteD1();
  databases.push(database);
  const { db, sqlite, calls } = database;
  const batches = [];
  const batch = db.batch.bind(db);
  db.batch = statements => { batches.push(statements); return batch(statements); };
  sqlite.prepare("UPDATE settings SET setting_value=? WHERE setting_key='ranking_update_frequency'").run(frequency);
  for (const channel of channels) sqlite.prepare('INSERT INTO vtubers(id,name,slug,platform,channel_url,youtube_url) VALUES (?,?,?,?,?,?)')
    .run(channel.id, `Channel ${channel.id}`, `channel-${channel.id}`, channel.platform ?? null, channel.channel_url || channel.youtube_url || '', channel.youtube_url || '');
  if (lastSuccess) {
    sqlite.prepare("INSERT INTO ranking_pipeline_runs(id,trigger_source,frequency,status,started_at,completed_at) VALUES ('previous','scheduled',?,'succeeded',?,?)")
      .run(frequency, latestRun?.started_at || lastSuccess.completed_at, lastSuccess.completed_at);
    if (!channels.length) {
      sqlite.exec("INSERT INTO vtubers(id,name,slug,channel_url) VALUES (999,'Existing','existing','https://youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa'); INSERT INTO stats_snapshots(vtuber_id,followers) VALUES (999,1)");
      sqlite.prepare("INSERT INTO rankings(vtuber_id,period,category,month,rank,score) VALUES (999,'monthly','followers',?,1,1)")
        .run(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7) + '-01');
    }
  }
  return { db, sqlite, calls, batches };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  databases.splice(0).forEach(database => database.close());
});

describe('updateAll', () => {
  it('skips scheduled updates when ranking frequency is manual', async () => {
    const { db, calls } = pipelineDb({ frequency: 'manual' });

    await expect(updateAll({ DB: db }, false, { triggerSource: 'scheduled' })).resolves.toEqual({
      ok: true, skipped: 'manual', freq: 'manual',
    });
    expect(calls.some(call => call.sql.includes('INSERT INTO ranking_pipeline_runs'))).toBe(false);
  });

  it('skips an hourly update within its interval after a successful run', async () => {
    const completedAt = new Date(Date.now() - 30_000).toISOString();
    const { db, calls } = pipelineDb({
      frequency: 'hourly',
      lastSuccess: { completed_at: completedAt },
      latestRun: { status: 'succeeded', started_at: completedAt },
    });

    await expect(updateAll({ DB: db }, false, { triggerSource: 'scheduled' })).resolves.toMatchObject({
      ok: true, skipped: 'not due', freq: 'hourly', last_run: completedAt,
    });
    expect(calls.some(call => call.sql.includes('INSERT INTO ranking_pipeline_runs'))).toBe(false);
  });

  it('records snapshots and publishes all six rankings after every channel succeeds', async () => {
    const firstId = channelId('a');
    const secondId = channelId('b');
    const { db, sqlite } = pipelineDb({
      frequency: 'hourly',
      channels: [
        { id: 1, youtube_url: `https://youtube.com/channel/${firstId}` },
        { id: 2, youtube_url: `https://youtube.com/channel/${secondId}` },
      ],
    });
    const fetchMock = vi.fn(async url => ({
      ok: true,
      json: async () => ({ items: new URL(url).searchParams.get('id').split(',').map(id => ({ id, statistics: { subscriberCount: '123', viewCount: '4567', videoCount: '89' } })) }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: true, status: 'succeeded', updated: 2, rankingsPublished: 6, errors: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`id=${firstId}`);
    expect(String(fetchMock.mock.calls[0][0])).toContain('key=test-key');
    expect(sqlite.prepare('SELECT vtuber_id,followers,total_views,video_count,recorded_at FROM stats_snapshots ORDER BY vtuber_id').all()).toEqual([
      { vtuber_id: 1, followers: 123, total_views: 4567, video_count: 89, recorded_at: expect.any(String) },
      { vtuber_id: 2, followers: 123, total_views: 4567, video_count: 89, recorded_at: expect.any(String) },
    ]);
    expect(sqlite.prepare('SELECT DISTINCT period,category FROM rankings ORDER BY period,category').all()).toEqual(
      ['alltime', 'monthly'].flatMap(period => ['followers', 'videos', 'views'].map(category => ({ period, category }))));
    expect(sqlite.prepare('SELECT status,channels_total,snapshots_written,rankings_published,errors_json,error_summary FROM ranking_pipeline_runs').get())
      .toEqual({ status: 'succeeded', channels_total: 2, snapshots_written: 2, rankings_published: 6, errors_json: '[]', error_summary: '' });
  });

  it('does not save partial snapshots or publish rankings when a channel fetch fails', async () => {
    const { db, sqlite } = pipelineDb({
      frequency: 'hourly',
      channels: [{ id: 1, youtube_url: `https://youtube.com/channel/${channelId('c')}` }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0 });
    expect(result.errors).toEqual([{ vtuber_id: 1, reason: 'YouTube API returned 503' }]);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM rankings').get().count).toBe(0);
    expect(sqlite.prepare('SELECT status,channels_total,snapshots_written,rankings_published FROM ranking_pipeline_runs').get())
      .toEqual({ status: 'partial', channels_total: 1, snapshots_written: 0, rankings_published: 0 });
  });

  it('syncs valid YouTube channels while reporting invalid YouTube IDs and ignoring other platforms', async () => {
    const id = channelId('d');
    const { db, sqlite } = pipelineDb({
      frequency: 'hourly',
      channels: [
        { id: 1, platform: 'youtube', youtube_url: `https://youtube.com/channel/${id}` },
        { id: 2, platform: 'twitch', channel_url: 'https://twitch.tv/example' },
        { id: 3, platform: 'bilibili', youtube_url: `https://youtube.com/channel/${channelId('e')}` },
        { id: 4, platform: 'youtube', youtube_url: 'https://youtube.com/@missing-id' },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id, statistics: { subscriberCount: '12', viewCount: '34', videoCount: '5' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: true, status: 'succeeded', updated: 1, rankingsPublished: 6 });
    expect(result.errors).toEqual([{ vtuber_id: 4, reason: 'no YouTube channel ID' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`id=${id}`);
    expect(sqlite.prepare('SELECT vtuber_id FROM stats_snapshots').all()).toEqual([{ vtuber_id: 1 }]);
    expect(sqlite.prepare('SELECT status,channels_total,snapshots_written,rankings_published,errors_json,error_summary FROM ranking_pipeline_runs').get())
      .toMatchObject({ status: 'succeeded', channels_total: 2, snapshots_written: 1, rankings_published: 6, errors_json: expect.stringContaining('no YouTube channel ID'), error_summary: expect.stringContaining('ข้าม 1 ช่อง') });
  });

  it('skips a run with only non-YouTube channels without requiring a YouTube key', async () => {
    const { db, calls } = pipelineDb({
      frequency: 'hourly',
      channels: [
        { id: 1, platform: 'twitch', channel_url: 'https://twitch.tv/example' },
        { id: 2, platform: 'bilibili', channel_url: 'https://bilibili.com/example' },
      ],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateAll({ DB: db }, false, { triggerSource: 'scheduled' })).resolves.toEqual({
      ok: true, skipped: 'no YouTube channels', freq: 'hourly',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(calls.some(call => call.sql.includes('INSERT INTO ranking_pipeline_runs'))).toBe(false);
  });

  it('records a configuration warning when no YouTube channel has a usable ID', async () => {
    const { db, sqlite } = pipelineDb({
      frequency: 'hourly',
      channels: [{ id: 1, platform: 'youtube', youtube_url: 'https://youtube.com/@missing-id' }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0 });
    expect(result.errors).toEqual([{ vtuber_id: 1, reason: 'no YouTube channel ID' }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(0);
    expect(sqlite.prepare('SELECT status,channels_total,snapshots_written,rankings_published,error_summary FROM ranking_pipeline_runs').get())
      .toMatchObject({ status: 'partial', channels_total: 1, snapshots_written: 0, rankings_published: 0, error_summary: expect.stringContaining('ไม่มี YouTube channel ID') });
  });

  it('accepts only authenticated POST requests for a manual run', async () => {
    stubWorkerCrypto();
    const db = { prepare: vi.fn(() => { throw new Error('database should not be read'); }) };
    const env = { DB: db, UPDATER_RUN_TOKEN: 'run-token', YOUTUBE_API_KEY: 'youtube-key' };
    const url = 'https://updater.example/?run=youtube-key&force=1';

    const getResponse = await updater.fetch(new Request(url, { headers: { Authorization: 'Bearer run-token' } }), env);
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get('Allow')).toBe('POST');

    const missingResponse = await updater.fetch(new Request(url, { method: 'POST' }), env);
    expect(missingResponse.status).toBe(403);

    const wrongResponse = await updater.fetch(new Request(url, { method: 'POST', headers: { Authorization: 'Bearer wrong-token' } }), env);
    expect(wrongResponse.status).toBe(403);

    const unconfiguredResponse = await updater.fetch(new Request(url, { method: 'POST', headers: { Authorization: 'Bearer run-token' } }), { ...env, UPDATER_RUN_TOKEN: undefined });
    expect(unconfiguredResponse.status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('runs a manual POST with the separate updater token', async () => {
    const { db, calls } = pipelineDb({
      frequency: 'manual',
      channels: [{ id: 1, platform: 'twitch', channel_url: 'https://twitch.tv/example' }],
    });
    stubWorkerCrypto();

    const response = await updater.fetch(new Request('https://updater.example/?force=1', {
      method: 'POST', headers: { Authorization: 'Bearer run-token' },
    }), { DB: db, UPDATER_RUN_TOKEN: 'run-token' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, skipped: 'no YouTube channels', freq: 'manual' });
    expect(calls.some(call => call.sql.includes('FROM vtubers v'))).toBe(true);
  });

  it('records a failed run when the YouTube key is not configured', async () => {
    const { db, sqlite } = pipelineDb({ frequency: 'hourly' });

    await expect(updateAll({ DB: db }, false, { triggerSource: 'scheduled' })).rejects.toThrow('ยังไม่ได้ตั้งค่า YouTube API Key');
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM rankings').get().count).toBe(0);
    expect(sqlite.prepare('SELECT status,channels_total,snapshots_written,rankings_published,error_summary FROM ranking_pipeline_runs').get())
      .toEqual({ status: 'failed', channels_total: 0, snapshots_written: 0, rankings_published: 0, error_summary: 'ยังไม่ได้ตั้งค่า YouTube API Key' });
  });
});
