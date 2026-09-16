import { describe, expect, it } from 'vitest';
import publicApi from '../../server/public.js';
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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

describe('public API status', () => {
  it('reports the service status', async () => {
    const { response } = await publicRequest('/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', service: 'VTuber Thai Ranking API' });
  });
});

describe('public rankings', () => {
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
});

describe('public vtuber detail', () => {
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
  it('returns totals, choices and the latest update', async () => {
    const { response } = await publicRequest('/summary/', [
      { count: 3 },
      { total: 1000 },
      null,
      { recorded_at: '2026-09-01T00:00:00.000Z' },
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
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
