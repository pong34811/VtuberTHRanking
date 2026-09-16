import { Hono } from 'hono';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  body,
  channel,
  competitionRanks,
  csvCell,
  currentMonth,
  nextMonthBoundary,
  previousMonth,
  selection,
} from '../../../server/admin-domain.js';

afterEach(() => vi.restoreAllMocks());

function bodyApp(allowed = ['name']) {
  const app = new Hono();
  app.onError((error, c) => c.json({ message: error.message }, error.status || 500));
  app.post('/', async c => c.json(await body(c, allowed)));
  return app;
}

describe('competitionRanks', () => {
  it('orders followers descending with competition ranks', () => {
    expect(competitionRanks([
      { vtuber_id: 3, followers: 100 },
      { vtuber_id: 1, followers: 300 },
      { vtuber_id: 2, followers: 200 },
    ], 'followers')).toMatchObject([
      { vtuber_id: 1, score: 300, rank: 1 },
      { vtuber_id: 2, score: 200, rank: 2 },
      { vtuber_id: 3, score: 100, rank: 3 },
    ]);
  });

  it('orders views by total_views', () => {
    expect(competitionRanks([
      { vtuber_id: 1, total_views: 15 },
      { vtuber_id: 2, total_views: 25 },
    ], 'views')).toMatchObject([
      { vtuber_id: 2, score: 25, rank: 1 },
      { vtuber_id: 1, score: 15, rank: 2 },
    ]);
  });

  it('orders videos by video_count', () => {
    expect(competitionRanks([
      { vtuber_id: 1, video_count: 4 },
      { vtuber_id: 2, video_count: 9 },
    ], 'videos')).toMatchObject([
      { vtuber_id: 2, score: 9, rank: 1 },
      { vtuber_id: 1, score: 4, rank: 2 },
    ]);
  });

  it('gives tied scores the same rank and skips the following rank', () => {
    expect(competitionRanks([
      { vtuber_id: 2, followers: 100 },
      { vtuber_id: 1, followers: 100 },
      { vtuber_id: 3, followers: 50 },
    ], 'followers')).toMatchObject([
      { vtuber_id: 1, rank: 1 },
      { vtuber_id: 2, rank: 1 },
      { vtuber_id: 3, rank: 3 },
    ]);
  });

  it('calculates rank change from the previous ranking', () => {
    expect(competitionRanks([
      { vtuber_id: 1, followers: 200 },
      { vtuber_id: 2, followers: 100 },
      { vtuber_id: 3, followers: 50 },
    ], 'followers', [
      { vtuber_id: 1, rank: 2 },
      { vtuber_id: 2, rank: 1 },
    ])).toMatchObject([
      { vtuber_id: 1, rank: 1, rank_change: 1 },
      { vtuber_id: 2, rank: 2, rank_change: -1 },
      { vtuber_id: 3, rank: 3, rank_change: 0 },
    ]);
  });
});

describe('ranking period helpers', () => {
  it('uses Bangkok current month for monthly selections', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-01-31T20:00:00.000Z'));
    expect(currentMonth()).toBe('2026-02');
    expect(selection({})).toEqual({ period: 'monthly', category: 'followers', month: '2026-02-01' });
  });

  it('calculates the current monthly cutoff', () => {
    expect(nextMonthBoundary('2026-09-01')).toBe('2026-09-30T17:00:00.000Z');
  });

  it('calculates a previous monthly ranking period', () => {
    expect(previousMonth('2026-09-01')).toBe('2026-08-01');
  });

  it('rolls January back to December of the previous year', () => {
    expect(previousMonth('2026-01-01')).toBe('2025-12-01');
  });

  it('accepts a supplied monthly selection', () => {
    expect(selection({ period: 'monthly', month: '2026-09', category: 'views' }))
      .toEqual({ period: 'monthly', category: 'views', month: '2026-09-01' });
  });

  it('accepts all-time selection without a month', () => {
    expect(selection({ period: 'alltime', month: '2026-09', category: 'videos' }))
      .toEqual({ period: 'alltime', category: 'videos', month: null });
  });

  it('rejects an invalid ranking period', () => {
    expect(() => selection({ period: 'weekly' })).toThrow('Invalid period');
  });

  it('rejects an invalid ranking category', () => {
    expect(() => selection({ category: 'likes' })).toThrow('Invalid category');
  });
});

describe('CSV serialization', () => {
  it('quotes ordinary CSV cells', () => {
    expect(csvCell('hello')).toBe('"hello"');
  });

  it('escapes embedded quotes', () => {
    expect(csvCell('She said "hello"')).toBe('"She said ""hello"""');
  });

  it.each(['=SUM(A1)', '+1+1', '-cmd', '@cmd', '\t=SUM(A1)'])('prevents formula injection for %j', value => {
    expect(csvCell(value)).toBe(`"'${value}"`);
  });
});

describe('channel validation', () => {
  const valid = { name: 'Test Channel', slug: 'test-channel' };

  it('accepts a lowercase hyphenated channel slug', () => {
    expect(channel(valid).slug).toBe('test-channel');
  });

  it('rejects an invalid channel slug', () => {
    expect(() => channel({ ...valid, slug: 'Invalid Slug' })).toThrow('Slug must use lowercase letters, numbers and hyphens');
  });

  it('accepts a real calendar debut date', () => {
    expect(channel({ ...valid, debut_date: '2024-02-29' }).debut_date).toBe('2024-02-29');
  });

  it('rejects an impossible debut date', () => {
    expect(() => channel({ ...valid, debut_date: '2025-02-29' })).toThrow('Invalid debut_date');
  });

  it('accepts a normal HTTPS channel URL', () => {
    expect(channel({ ...valid, channel_url: 'https://example.com/channel' }).channel_url).toBe('https://example.com/channel');
  });

  it('rejects a URL with credentials', () => {
    expect(() => channel({ ...valid, channel_url: 'https://user:pass@example.com' })).toThrow('Invalid channel_url');
  });

  it('accepts the documented enums and an active state of zero', () => {
    expect(channel({ ...valid, category: 'art', affiliation: 'agency', platform: 'twitch', is_active: 0 }))
      .toMatchObject({ category: 'art', affiliation: 'agency', platform: 'twitch', is_active: 0 });
  });

  it('rejects an invalid enum', () => {
    expect(() => channel({ ...valid, platform: 'kick' })).toThrow('Invalid platform');
  });

  it('rejects an invalid active state', () => {
    expect(() => channel({ ...valid, is_active: 'yes' })).toThrow('Invalid is_active');
  });
});

describe('JSON request body validation', () => {
  it('rejects a request with the wrong content type', async () => {
    const response = await bodyApp().fetch(new Request('https://example.com/', { method: 'POST', body: '{"name":"Ada"}' }));
    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ message: 'JSON body required' });
  });

  it('rejects a body larger than 32768 bytes', async () => {
    const response = await bodyApp().fetch(new Request('https://example.com/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'a'.repeat(32769) }),
    }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ message: 'Request body too large' });
  });

  it('rejects a JSON array body', async () => {
    const response = await bodyApp().fetch(new Request('https://example.com/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: 'Expected JSON object' });
  });

  it('rejects unknown JSON fields', async () => {
    const response = await bodyApp().fetch(new Request('https://example.com/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Ada","unknown":true}',
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ message: 'Unknown field' });
  });
});
