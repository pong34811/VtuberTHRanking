import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { calculateRanking } = vi.hoisted(() => ({ calculateRanking: vi.fn() }));
vi.mock('../../../server/ranking-service.js', () => ({ calculateRanking }));

import { updateAll } from '../../../../worker/updater.js';

const channelId = suffix => `UC${String(suffix).repeat(22).slice(0, 22)}`;

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
