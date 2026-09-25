import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { timingSafeEqual } from 'node:crypto';

const { calculateRanking } = vi.hoisted(() => ({ calculateRanking: vi.fn() }));
vi.mock('../../../server/ranking-service.js', () => ({ calculateRanking }));

import updater, { updateAll } from '../../../../worker/updater.js';

const channelId = suffix => `UC${String(suffix).repeat(22).slice(0, 22)}`;

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
  const calls = [];
  const batches = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          calls.push({ sql, values: this.values, operation: 'first' });
          if (sql.includes("setting_key='ranking_update_frequency'")) return { setting_value: frequency };
          if (sql.includes('SELECT completed_at FROM ranking_pipeline_runs')) return lastSuccess;
          if (sql.includes('SELECT status,started_at FROM ranking_pipeline_runs')) return latestRun;
          return null;
        },
        async all() {
          calls.push({ sql, values: this.values, operation: 'all' });
          return sql.includes('FROM vtubers WHERE is_active=1') ? { results: channels } : { results: [] };
        },
        async run() {
          calls.push({ sql, values: this.values, operation: 'run' });
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
  return { db, calls, batches };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  calculateRanking.mockReset().mockResolvedValue({ count: 2 });
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
    const { db, calls, batches } = pipelineDb({
      frequency: 'hourly',
      channels: [
        { id: 1, youtube_url: `https://youtube.com/channel/${firstId}` },
        { id: 2, youtube_url: `https://youtube.com/channel/${secondId}` },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ statistics: { subscriberCount: '123', viewCount: '4567', videoCount: '89' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: true, status: 'succeeded', updated: 2, rankingsPublished: 6, errors: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`id=${firstId}`);
    expect(String(fetchMock.mock.calls[0][0])).toContain('key=test-key');
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0][0].sql).toContain('INSERT INTO stats_snapshots');
    expect(batches[0][0].values).toMatchObject([1, 123, 4567, 89, expect.any(String)]);
    expect(calculateRanking.mock.calls.map(([, filter]) => `${filter.period}:${filter.category}`)).toEqual([
      'monthly:followers', 'monthly:views', 'monthly:videos',
      'alltime:followers', 'alltime:views', 'alltime:videos',
    ]);
    expect(calls.at(-1)).toMatchObject({
      sql: expect.stringContaining('UPDATE ranking_pipeline_runs SET status=?'),
      values: ['succeeded', expect.any(String), 2, 2, 6, '[]', '', expect.any(String)],
    });
  });

  it('does not save partial snapshots or publish rankings when a channel fetch fails', async () => {
    const { db, batches, calls } = pipelineDb({
      frequency: 'hourly',
      channels: [{ id: 1, youtube_url: `https://youtube.com/channel/${channelId('c')}` }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0 });
    expect(result.errors).toEqual([{ vtuber_id: 1, reason: 'YouTube API returned 503' }]);
    expect(batches).toHaveLength(0);
    expect(calculateRanking).not.toHaveBeenCalled();
    expect(calls.at(-1).values).toMatchObject(['partial', expect.any(String), 1, 0, 0, expect.any(String), expect.any(String), expect.any(String)]);
  });

  it('syncs valid YouTube channels while reporting invalid YouTube IDs and ignoring other platforms', async () => {
    const id = channelId('d');
    const { db, calls, batches } = pipelineDb({
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
      json: async () => ({ items: [{ statistics: { subscriberCount: '12', viewCount: '34', videoCount: '5' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: true, status: 'succeeded', updated: 1, rankingsPublished: 6 });
    expect(result.errors).toEqual([{ vtuber_id: 4, reason: 'no YouTube channel ID' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`id=${id}`);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(calls.at(-1)).toMatchObject({
      values: ['succeeded', expect.any(String), 2, 1, 6, expect.stringContaining('no YouTube channel ID'), expect.stringContaining('ข้าม 1 ช่อง'), expect.any(String)],
    });
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
    const { db, calls, batches } = pipelineDb({
      frequency: 'hourly',
      channels: [{ id: 1, platform: 'youtube', youtube_url: 'https://youtube.com/@missing-id' }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' }, false, { triggerSource: 'scheduled' });

    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0 });
    expect(result.errors).toEqual([{ vtuber_id: 1, reason: 'no YouTube channel ID' }]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(batches).toHaveLength(0);
    expect(calls.at(-1).values).toMatchObject(['partial', expect.any(String), 1, 0, 0, expect.any(String), expect.stringContaining('ไม่มี YouTube channel ID'), expect.any(String)]);
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
    expect(calls.some(call => call.sql.includes('FROM vtubers WHERE is_active=1'))).toBe(true);
  });

  it('records a failed run when the YouTube key is not configured', async () => {
    const { db, calls } = pipelineDb({ frequency: 'hourly' });

    await expect(updateAll({ DB: db }, false, { triggerSource: 'scheduled' })).rejects.toThrow('ยังไม่ได้ตั้งค่า YouTube API Key');
    expect(calculateRanking).not.toHaveBeenCalled();
    expect(calls.at(-1)).toMatchObject({
      sql: expect.stringContaining('UPDATE ranking_pipeline_runs SET status=?'),
      values: ['failed', expect.any(String), 0, 0, 0, expect.any(String), 'ยังไม่ได้ตั้งค่า YouTube API Key', expect.any(String)],
    });
  });
});
