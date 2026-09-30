import { afterEach, describe, expect, it, vi } from 'vitest';
import { addSnapshot, backendDatabase, mountedRequest, seedChannel } from '../helpers/backend-sqlite.js';

const stores = [];
const database = () => { const store = backendDatabase(); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); vi.restoreAllMocks(); vi.useRealTimers(); });
const rank = (store, id, month, score, movement, category = 'followers') => store.sql.prepare("INSERT INTO rankings(vtuber_id,period,category,month,rank,score,rank_change) VALUES (?,'monthly',?,?,1,?,?)").run(id, category, `${month}-01`, score, movement);

describe('shared chronological public reads', () => {
  it('selects mixed-format chronological latest with an ID tie-break for profile, search and summary', async () => {
    const store = database();
    seedChannel(store);
    addSnapshot(store, 1, 100, '2026-09-01T08:00:00.000Z', 3);
    addSnapshot(store, 1, 90, '2026-09-01 12:00:00', 4);
    addSnapshot(store, 1, 80, '2026-09-01 12:00:00', 5);
    const profile = await mountedRequest(store, '/vtubers/alpha/');
    expect(profile.status).toBe(200);
    expect(profile.body.latest_stats).toMatchObject({ followers: 80, video_count: 5, recorded_at: '2026-09-01T12:00:00.000Z' });
    const listing = await mountedRequest(store, '/vtubers/');
    expect(listing.body.results[0].followers).toBe(80);
    const summary = await mountedRequest(store, '/summary/');
    expect(summary.body.total_followers_all).toBe(80);
    expect(summary.body.last_collected_at).toBe('2026-09-01T12:00:00.000Z');
  });
});

describe('published summary and operational ranking month', () => {
  it('sums latest active channels and filters movement by month, metric and eligible published population', async () => {
    const store = database();
    for (const [id, name, options] of [[1, 'Alpha', {}], [2, 'Beta', {}], [3, 'Hidden', { active: 0 }], [4, 'Twitch', { platform: 'twitch' }], [5, 'Empty', {}]]) seedChannel(store, id, name, options);
    addSnapshot(store, 1, 100, '2026-08-01T00:00:00Z');
    addSnapshot(store, 1, 90, '2026-08-02T00:00:00Z');
    addSnapshot(store, 2, 200, '2026-08-02 01:00:00');
    addSnapshot(store, 3, 5000, '2026-09-01T00:00:00Z');
    addSnapshot(store, 4, 30, '2026-08-02T00:00:00Z');
    store.sql.exec("UPDATE settings SET setting_value='2026-08' WHERE setting_key='current_ranking_period'; UPDATE settings SET setting_value='Archive Ranking' WHERE setting_key='site_name'");
    rank(store, 1, '2026-07', 100, 99);
    rank(store, 1, '2026-08', 90, 5, 'views');
    rank(store, 1, '2026-08', 90, 2);
    rank(store, 2, '2026-08', 200, 3);
    rank(store, 3, '2026-08', 5000, 500);
    rank(store, 4, '2026-08', 30, 50);
    const run = store.sql.prepare("INSERT INTO ranking_pipeline_runs(id,trigger_source,frequency,status,started_at,completed_at) VALUES (?,'scheduled','daily',?,?,?)");
    run.run('published', 'succeeded', '2026-08-02T01:00:00Z', '2026-08-02T01:30:00Z');
    run.run('failed', 'failed', '2026-09-01T00:00:00Z', '2026-09-01T00:30:00Z');
    const result = await mountedRequest(store, '/summary/');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      total_vtubers: 4, total_followers_all: 320,
      top_gainer: { vtuber: { id: 2, name: 'Beta', slug: 'beta' }, rank_change: 3 },
      ranking_month: '2026-08', available_months: ['2026-08', '2026-07'],
      last_collected_at: '2026-08-02T01:00:00.000Z', last_published_at: '2026-08-02T01:30:00Z', latest_update: '2026-08-02T01:30:00Z',
      site_name: 'Archive Ranking', site_status: 'active',
    });
    expect(result.body.category_choices.map(choice => choice.value)).toEqual(['followers', 'views', 'videos']);
    const historical = await mountedRequest(store, '/summary/?month=2026-07');
    expect(historical.body.top_gainer.vtuber.id).toBe(1);
    expect(historical.body.ranking_month).toBe('2026-07');
    const rankings = await mountedRequest(store, '/rankings/');
    expect(rankings.body.month).toBe('2026-08');
    expect(rankings.body.results.map(row => row.vtuber.id)).toEqual([1, 2]);
    const profile = await mountedRequest(store, '/vtubers/alpha/');
    expect(profile.body).toMatchObject({ ranking_month: '2026-08', current_rank: { monthly_followers: 1 } });
    expect(profile.body.category_choices).toEqual(result.body.category_choices);
    expect((await mountedRequest(store, '/rankings/?month=2026-07')).body.month).toBe('2026-07');
    expect((await mountedRequest(store, '/rankings/?month=2026-13')).body.month).toBe('2026-08');
  });

  it('uses null publication freshness and zero totals when there is no data', async () => {
    const store = database();
    const result = await mountedRequest(store, '/summary/');
    expect(result.body).toMatchObject({ total_vtubers: 0, total_followers_all: 0, top_gainer: null, last_collected_at: null, last_published_at: null, latest_update: null, available_months: [] });
  });
});

describe('bounded daily Bangkok histories', () => {
  it('rolls up to chronological latest per Bangkok day and paginates before returning data', async () => {
    const store = database();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-05T12:00:00Z'));
    seedChannel(store);
    addSnapshot(store, 1, 1, '2026-09-01T16:59:59Z');
    addSnapshot(store, 1, 2, '2026-09-01T17:00:00Z');
    addSnapshot(store, 1, 3, '2026-09-01T18:00:00Z');
    addSnapshot(store, 1, 4, '2026-09-01 19:00:00');
    addSnapshot(store, 1, 5, '2026-09-01 19:00:00');
    const first = await mountedRequest(store, '/vtubers/alpha/history/?months=12&limit=1');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ timezone: 'Asia/Bangkok', granularity: 'day', total: 2, count: 1, limit: 1, offset: 0, previous: null, history: [{ date: '2026-09-01', followers: 1, recorded_at: '2026-09-01T16:59:59Z' }] });
    const nextUrl = new URL(first.body.next, 'https://test.invalid');
    expect(nextUrl.searchParams.get('months')).toBe('12');
    const second = await mountedRequest(store, nextUrl.pathname.replace('/api/v1', '') + nextUrl.search);
    expect(second.body).toMatchObject({ total: 2, count: 1, offset: 1, next: null, history: [{ date: '2026-09-02', followers: 5, recorded_at: '2026-09-01T19:00:00.000Z' }] });
    expect(second.body.previous).toContain('offset=0');
  });

  it('keeps a 12-month maximum and bounded pagination for history and compare', async () => {
    const store = database();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T17:00:00Z'));
    seedChannel(store); seedChannel(store, 2, 'Beta');
    for (const id of [1, 2]) {
      addSnapshot(store, id, 10, '2025-09-30T16:59:59Z');
      addSnapshot(store, id, 20, '2025-09-30T17:00:00Z');
      addSnapshot(store, id, 30, '2026-09-30T17:00:00Z');
      addSnapshot(store, id, 40, '2026-10-02T00:00:00Z');
    }
    const history = await mountedRequest(store, '/vtubers/alpha/history/?months=99&limit=9000&offset=9000');
    expect(history.body).toMatchObject({ total: 2, limit: 400, offset: 400, count: 0 });
    const compare = await mountedRequest(store, '/compare/', { method: 'POST', payload: { vtubers: [1, 2], months: 99, category: 'followers', limit: 1 } });
    expect(compare.status).toBe(200);
    expect(compare.body).toMatchObject({ timezone: 'Asia/Bangkok', granularity: 'day', limit: 1, offset: 0, count: 2, total: 4, previous: null });
    expect(compare.body.next).toContain('offset=1');
    for (const vtuber of compare.body.vtubers) {
      expect(vtuber).toMatchObject({ total: 2, count: 1, history: [{ date: '2025-10-01', recorded_at: '2025-09-30T17:00:00Z', value: 20 }] });
    }
    const compareNext = await mountedRequest(store, '/compare/?limit=1&offset=1', { method: 'POST', payload: { vtubers: [1, 2], months: 12 } });
    expect(compareNext.body.next).toBeNull();
    expect(compareNext.body.previous).toContain('offset=0');
    expect(compareNext.body.vtubers[0].history[0].date).toBe('2026-10-01');
  });

  it.each([[{ id: 1 }, 2], [1, 1], [0, 2], [-1, 2], ['1', 2], [1.5, 2], [true, 2], [null, 2], [9007199254740992, 2]].map(ids => [ids]))('rejects malformed or duplicate compare IDs %j before binding them', async vtubers => {
    const store = database();
    const result = await mountedRequest(store, '/compare/', { method: 'POST', payload: { vtubers } });
    expect(result.status).toBe(400);
    expect(store.calls.some(call => /FROM vtubers WHERE id/.test(call.sql))).toBe(false);
    expect(store.calls.some(call => call.values.some(value => value && typeof value === 'object'))).toBe(false);
  });
});
