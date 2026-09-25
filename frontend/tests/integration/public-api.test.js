import { afterEach, describe, expect, it, vi } from 'vitest';
import publicApi from '../../server/public.js';
import { selection } from '../../server/admin-domain.js';
import { createD1Stub } from '../helpers/d1.js';

async function publicRequest(path, responses = [], init = {}) {
  const { calls, db } = createD1Stub(responses);
  const response = await publicApi.fetch(new Request(`https://example.com${path}`, init), { DB: db });
  return { calls, response };
}

async function publicRequestWithoutDb(path, init = {}) {
  return publicApi.fetch(new Request(`https://example.com${path}`, init), {});
}

const currentMonth = () => {
  const now = new Date(Date.now() + 7 * 3600000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

afterEach(() => vi.useRealTimers());

describe('Bangkok ranking month boundaries', () => {
  it.each([
    ['2026-09-30T16:59:59.999Z', '2026-09'],
    ['2026-09-30T17:00:00.000Z', '2026-10'],
    ['2026-09-30T23:59:59.999Z', '2026-10'],
    ['2026-12-31T17:00:00.000Z', '2027-01'],
  ])('uses %s consistently across rankings, profiles and admin', async (time, month) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(time));
    const rankings = await publicRequest('/rankings/?limit=1', [{ total: 2 }, { results: [] }]);
    const body = await rankings.response.json();
    expect(body.month).toBe(month);
    expect(new URL(body.next, 'https://example.com').searchParams.get('month')).toBe(month);
    expect(rankings.calls[0].values).toContain(`${month}-01`);
    const profile = await publicRequest('/vtubers/aiko/', [{ id: 3 }, { results: [] }, null]);
    expect(profile.calls[1].values).toEqual([3, `${month}-01`]);
    expect(selection({}).month).toBe(`${month}-01`);
  });
});

describe('public API status', () => {
  it('reports the service status', async () => {
    const { response } = await publicRequest('/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'VTuber Thai Ranking API' });
  });
});

describe('public rankings', () => {
  it('preserves month, category and page size in both navigation links', async () => {
    const { response } = await publicRequest('/rankings/?month=2025-02&category=videos&limit=10&offset=20', [{ total: 80 }, { results: [] }]);
    const body = await response.json();
    for (const [link, offset] of [[body.next, '30'], [body.previous, '10']]) {
      const params = new URL(link, 'https://example.com').searchParams;
      expect(Object.fromEntries(params)).toEqual({ period: 'monthly', category: 'videos', month: '2025-02', limit: '10', offset });
    }
  });

  it.each(['nope', '-5', '2.5', '1x', '9007199254740992'])('normalizes malformed pagination %s', async value => {
    const { calls } = await publicRequest(`/rankings/?limit=${value}&offset=${value}`, [{ total: 0 }, { results: [] }]);
    expect(calls[1].values.slice(-2)).toEqual([50, 0]);
  });

  it('uses at least one result per page', async () => {
    const { calls } = await publicRequest('/rankings/?limit=0', [{ total: 0 }, { results: [] }]);
    expect(calls[1].values.at(-2)).toBe(1);
  });

  it('falls back to the current month for impossible month values', async () => {
    const { response } = await publicRequest('/rankings/?month=2026-13', [{ total: 0 }, { results: [] }]);
    expect((await response.json()).month).toBe(currentMonth());
  });

  it('omits month from alltime page links', async () => {
    const { response } = await publicRequest('/rankings/?period=alltime&month=2025-02&limit=10', [{ total: 80 }, { results: [] }]);
    const params = new URL((await response.json()).next, 'https://example.com').searchParams;
    expect(params.has('month')).toBe(false);
    expect(params.get('period')).toBe('alltime');
  });
  it('applies monthly and followers defaults for the current month', async () => {
    const { response } = await publicRequest('/rankings/', [{ total: 0 }, { results: [] }]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      period: 'monthly',
      category: 'followers',
      month: currentMonth(),
      total: 0,
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
  });

  it('falls back to defaults for invalid period and category', async () => {
    const { response } = await publicRequest('/rankings/?period=bogus&category=bogus', [{ total: 0 }, { results: [] }]);

    await expect(response.json()).resolves.toMatchObject({ period: 'monthly', category: 'followers' });
  });

  it('returns no month for the alltime period', async () => {
    const { response } = await publicRequest('/rankings/?period=alltime', [{ total: 0 }, { results: [] }]);

    await expect(response.json()).resolves.toMatchObject({ period: 'alltime', month: null });
  });

  it('caps the page size at 100 rows', async () => {
    const { calls } = await publicRequest('/rankings/?limit=500', [{ total: 0 }, { results: [] }]);
    const rowsQuery = calls.find(call => call.operation === 'all');

    expect(rowsQuery.values.at(-2)).toBe(100);
  });

  it('clamps a negative offset to zero', async () => {
    const { calls } = await publicRequest('/rankings/?offset=-10', [{ total: 0 }, { results: [] }]);
    const rowsQuery = calls.find(call => call.operation === 'all');

    expect(rowsQuery.values.at(-1)).toBe(0);
  });

  it('links to the next page when more rows remain', async () => {
    const { response } = await publicRequest('/rankings/', [{ total: 120 }, { results: [] }]);
    const body = await response.json();

    expect(body.total).toBe(120);
    expect(body.next).toContain('offset=50');
    expect(body.previous).toBeNull();
  });

  it('links to the previous page when past the first page', async () => {
    const { response } = await publicRequest('/rankings/?offset=100', [{ total: 120 }, { results: [] }]);
    const body = await response.json();

    expect(body.next).toBeNull();
    expect(body.previous).toContain('offset=50');
  });

  it('shapes ranking rows with nested vtuber data', async () => {
    const row = { rank: 1, score: 999, rank_change: 2, video_count: 10, id: 7, name: 'Aiko', slug: 'aiko', avatar: 'a.png', vtuber_category: 'gaming', affiliation: 'indie' };
    const { response } = await publicRequest('/rankings/', [{ total: 1 }, { results: [row] }]);

    await expect(response.json()).resolves.toMatchObject({
      total: 1,
      count: 1,
      results: [{
        rank: 1,
        vtuber: { id: 7, name: 'Aiko', slug: 'aiko', avatar: 'a.png', category: 'gaming', affiliation: 'indie', video_count: 10 },
        score: 999,
        rank_change: 2,
      }],
    });
  });
});

describe('public vtuber search', () => {
  it('returns matching vtubers with a count', async () => {
    const vtuber = { id: 1, name: 'Aiko', slug: 'aiko', avatar: 'a.png', category: 'gaming', affiliation: 'indie' };
    const { response } = await publicRequest('/vtubers/?q=aiko', [{ count: 1 }, { results: [vtuber] }]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 1, results: [vtuber] });
  });

  it('binds the search term as a partial match', async () => {
    const { calls } = await publicRequest('/vtubers/?q=aiko', [{ count: 0 }, { results: [] }]);

    expect(calls[0].values).toEqual(['%aiko%']);
  });

  it('filters by the latest follower range and returns followers in the selected order', async () => {
    const vtuber = { id: 1, name: 'Aiko', slug: 'aiko', avatar: 'a.png', category: 'gaming', affiliation: 'indie', followers: 450 };
    const { response, calls } = await publicRequest(
      '/vtubers/?min_followers=100&max_followers=900&sort=followers_desc',
      [{ count: 1 }, { results: [vtuber] }],
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 1, results: [vtuber] });
    expect(calls[0].sql).toContain('latest.followers >= ?');
    expect(calls[0].sql).toContain('latest.followers <= ?');
    expect(calls[0].sql).toContain('LEFT JOIN stats_snapshots latest');
    expect(calls[0].sql).toContain('ORDER BY s.recorded_at DESC, s.id DESC LIMIT 1');
    expect(calls[0].values).toEqual([100, 900]);
    expect(calls[1].values).toEqual([100, 900]);
    expect(calls[1].sql).toContain('CASE WHEN latest.followers IS NULL THEN 1 ELSE 0 END ASC');
    expect(calls[1].sql).toContain('latest.followers DESC');
  });

  it('rejects an inverted or invalid follower range before querying D1', async () => {
    for (const path of [
      '/vtubers/?min_followers=900&max_followers=100',
      '/vtubers/?min_followers=-1',
      '/vtubers/?max_followers=900000000000000000000',
    ]) {
      const { response, calls } = await publicRequest(path);
      expect(response.status).toBe(400);
      expect(calls).toHaveLength(0);
    }
  });

  it('uses a safe name ordering for an unknown sort option', async () => {
    const { calls } = await publicRequest('/vtubers/?sort=name;drop_table', [{ count: 0 }, { results: [] }]);

    expect(calls[1].sql).toContain('ORDER BY v.name COLLATE NOCASE ASC');
    expect(calls[1].sql).not.toContain('drop_table');
  });
});

describe('public vtuber detail', () => {
  it('requests only active current-month and alltime ranks', async () => {
    const { calls } = await publicRequest('/vtubers/aiko/', [{ id: 3 }, { results: [] }, null]);
    expect(calls[1].values).toEqual([3, `${currentMonth()}-01`]);
    expect(calls[1].sql).toContain("status = 'active'");
    expect(calls[1].sql).toContain("(period = 'monthly' AND month = ?) OR (period = 'alltime' AND month IS NULL)");
  });
  it('returns 404 for an unknown slug', async () => {
    const { response } = await publicRequest('/vtubers/unknown/', [null]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: true, status: 404, message: 'VTuber not found' });
  });

  it('returns ranks and latest stats for a known slug', async () => {
    const vtuber = { id: 3, name: 'Aiko', slug: 'aiko', is_active: 1, notes: 'internal reason' };
    const stats = { followers: 1000, total_views: 5000, avg_views: 100, recorded_at: '2026-09-01T00:00:00.000Z' };
    const { response } = await publicRequest('/vtubers/aiko/', [
      vtuber,
      { results: [{ period: 'monthly', category: 'followers', rank: 2 }] },
      stats,
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 3, name: 'Aiko', slug: 'aiko', is_active: 1,
      current_rank: { monthly_followers: 2 }, latest_stats: stats,
    });
  });
});

describe('public vtuber history', () => {
  it.each(['abc', '2.5', '1x', '9007199254740992'])('rejects invalid months %s before querying D1', async months => {
    const { response, calls } = await publicRequest(`/vtubers/aiko/history/?months=${months}`);
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('returns 404 for an unknown slug', async () => {
    const { response } = await publicRequest('/vtubers/unknown/history/', [null]);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: true, status: 404, message: 'VTuber not found' });
  });

  it('returns dated history for a known slug', async () => {
    const snapshots = [{ date: '2026-09-01', followers: 100, total_views: 1000, avg_views: 10 }];
    const { response } = await publicRequest('/vtubers/aiko/history/', [
      { id: 3, name: 'Aiko', slug: 'aiko' },
      { results: snapshots },
    ]);

    await expect(response.json()).resolves.toEqual({ vtuber: { id: 3, name: 'Aiko', slug: 'aiko' }, history: snapshots });
  });

  it('clamps months above 12 to a 12-month window', async () => {
    const vtuber = { id: 3, name: 'Aiko', slug: 'aiko' };
    const wide = await publicRequest('/vtubers/aiko/history/?months=99', [vtuber, { results: [] }]);
    const capped = await publicRequest('/vtubers/aiko/history/?months=12', [vtuber, { results: [] }]);

    expect(wide.calls[1].values[1]).toBe(capped.calls[1].values[1]);
  });

  it('clamps months below 1 to a 1-month window', async () => {
    const vtuber = { id: 3, name: 'Aiko', slug: 'aiko' };
    const narrow = await publicRequest('/vtubers/aiko/history/?months=0', [vtuber, { results: [] }]);
    const floored = await publicRequest('/vtubers/aiko/history/?months=1', [vtuber, { results: [] }]);

    expect(narrow.calls[1].values[1]).toBe(floored.calls[1].values[1]);
  });
});

describe('public compare', () => {
  it.each(['abc', 1.5, null, true, {}, 9007199254740992])('rejects invalid comparison months %s', async months => {
    const { response, calls } = await publicRequest('/compare/', [], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vtubers: [1, 2], months }),
    });
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rejects invalid JSON', async () => {
    const { response } = await publicRequest('/compare/', [], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: true, status: 400, message: 'Invalid JSON' });
  });

  it('requires 2 to 5 vtuber ids', async () => {
    const { response } = await publicRequest('/compare/', [], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vtubers: [1] }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: true, status: 400, message: 'vtubers must be 2-5 IDs' });
  });

  it('rejects an invalid category', async () => {
    const { response } = await publicRequest('/compare/', [], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vtubers: [1, 2], category: 'bogus' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: true, status: 400, message: 'Invalid category' });
  });

  it('returns colored histories for each vtuber', async () => {
    const snapshots = [{ date: '2026-09-01', value: 100 }];
    const { response } = await publicRequest('/compare/', [
      { id: 1, name: 'Aiko', slug: 'aiko' },
      { results: snapshots },
      { id: 2, name: 'Biko', slug: 'biko' },
      { results: snapshots },
    ], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vtubers: [1, 2] }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      category: 'followers',
      vtubers: [
        { id: 1, name: 'Aiko', slug: 'aiko', color: '#ef4444', history: snapshots },
        { id: 2, name: 'Biko', slug: 'biko', color: '#3b82f6', history: snapshots },
      ],
    });
  });
});

describe('public summary', () => {
  it('reports no update when active creators have no snapshots', async () => {
    const { response } = await publicRequest('/summary/', [
      { count: 1 },
      { total: null },
      null,
      null,
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ latest_update: null });
  });

  it('returns totals, choices and the latest update', async () => {
    const { response, calls } = await publicRequest('/summary/', [
      { count: 3 },
      { total: 1000 },
      null,
      { recorded_at: '2026-09-01T00:00:00.000Z' },
    ]);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      total_vtubers: 3,
      total_followers_all: 1000,
      top_gainer: null,
      latest_update: '2026-09-01T00:00:00.000Z',
      period_choices: [{ value: 'monthly', label: 'รายเดือน' }, { value: 'alltime', label: 'ทั้งหมด' }],
      category_choices: [
        { value: 'followers', label: 'ยอดผู้ติดตาม' },
        { value: 'views', label: 'ยอดวิว' },
        { value: 'videos', label: 'จำนวนคลิป' },
      ],
    });
    expect(calls).toHaveLength(4);
    expect(calls.some(call => /\bsettings\b/i.test(call.sql))).toBe(false);
    expect(body).not.toHaveProperty('homepage_template');
  });

  it('returns the top gainer when one exists', async () => {
    const { response } = await publicRequest('/summary/', [
      { count: 3 },
      { total: 1000 },
      { id: 1, name: 'Aiko', slug: 'aiko', rank_change: 5 },
      { recorded_at: '2026-09-01T00:00:00.000Z' },
    ]);

    await expect(response.json()).resolves.toMatchObject({
      top_gainer: { vtuber: { id: 1, name: 'Aiko', slug: 'aiko' }, rank_change: 5 },
    });
  });
});

describe('public API without a database', () => {
  it('reports DB unavailable for rankings', async () => {
    const response = await publicRequestWithoutDb('/rankings/');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'DB not available' });
  });
});
