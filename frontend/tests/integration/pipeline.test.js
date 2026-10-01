import { afterEach, describe, expect, it, vi } from 'vitest';
import updater, { updateAll } from '../../../worker/updater.js';
import { createSqliteD1 } from '../helpers/sqlite-d1.js';

const databases = [];
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); databases.splice(0).forEach(database => database.close()); });
function setup({ frequency = 'hourly', count = 2, time = '2026-09-01T10:00:00.000Z' } = {}) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(time));
  const database = createSqliteD1(); databases.push(database);
  database.sqlite.prepare("UPDATE settings SET setting_value=? WHERE setting_key='ranking_update_frequency'").run(frequency);
  const insert = database.sqlite.prepare('INSERT INTO vtubers(id,name,slug,channel_url,youtube_url) VALUES (?,?,?,?,?)');
  for (let id = 1; id <= count; id++) {
    const url = `https://youtube.com/channel/UC${String(id).padStart(22, '0')}`;
    insert.run(id, `Channel ${id}`, `channel-${id}`, url, url);
  }
  const network = vi.fn(async url => {
    const ids = new URL(url).searchParams.get('id').split(',');
    return { ok: true, json: async () => ({ items: ids.map(id => ({ id, statistics: { subscriberCount: String(Number(id.slice(2)) * 10), viewCount: '200', videoCount: '3' } })) }) };
  });
  vi.stubGlobal('fetch', network);
  return { ...database, network, env: { DB: database.db, YOUTUBE_API_KEY: 'synthetic-test-key' } };
}
const run = database => updateAll(database.env, false, { triggerSource: 'scheduled', scheduledTime: Date.now() });

describe('transactional updater pipeline', () => {
  it.each(['subscriberCount', 'viewCount', 'videoCount'])('reports a malformed JSON counter in %s as invalid statistics rather than a network failure', async field => {
    const database = setup({ count: 1 });
    database.network.mockImplementation(async url => ({ ok: true, json: async () => ({ items: [{
      id: new URL(url).searchParams.get('id'), statistics: { subscriberCount: '10', viewCount: '200', videoCount: '3', [field]: { toString: 'bad' } },
    }] }) }));
    await expect(run(database)).resolves.toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0,
      errors: [{ vtuber_id: 1, reason: 'YouTube returned invalid statistics' }] });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(0);
  });

  it.each([0, '0'])('publishes genuine zero counters from YouTube (%j)', async zero => {
    const database = setup({ count: 1 });
    database.network.mockImplementation(async url => ({ ok: true, json: async () => ({ items: [{
      id: new URL(url).searchParams.get('id'), statistics: { hiddenSubscriberCount: false, subscriberCount: zero, viewCount: zero, videoCount: zero },
    }] }) }));
    await expect(run(database)).resolves.toMatchObject({ ok: true, status: 'succeeded', updated: 1, rankingsPublished: 6 });
    expect(database.sqlite.prepare('SELECT followers,total_views,video_count FROM stats_snapshots').get()).toEqual({ followers: 0, total_views: 0, video_count: 0 });
    expect(database.sqlite.prepare('SELECT DISTINCT score FROM rankings').all()).toEqual([{ score: 0 }]);
  });

  it('honors the next scheduled hourly slot even when previous completion was two seconds late', async () => {
    const database = setup();
    database.sqlite.exec("INSERT INTO ranking_pipeline_runs(id,trigger_source,frequency,status,started_at,completed_at) VALUES ('previous','scheduled','hourly','succeeded','2026-09-01T09:00:00.000Z','2026-09-01T09:00:02.000Z')");
    await expect(run(database)).resolves.toMatchObject({ ok: true, status: 'succeeded', updated: 2, rankingsPublished: 6 });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(2);
  });
  it('atomically excludes a force/manual competitor while a scheduled owner is collecting', async () => {
    const database = setup();
    let enter, release;
    const entered = new Promise(resolve => { enter = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    const normal = database.network.getMockImplementation();
    database.network.mockImplementationOnce(async url => { enter(); await blocked; return normal(url); });
    const first = run(database);
    await entered;
    let result;
    try { result = await updateAll(database.env, true, { triggerSource: 'manual' }); }
    finally { release(); await first; }
    expect(result).toMatchObject({ ok: true, skipped: 'in progress' });
    expect(database.sqlite.prepare("SELECT COUNT(*) AS count FROM ranking_pipeline_runs WHERE status='succeeded'").get().count).toBe(1);
  });
  it('rolls back every public snapshot and ranking on the last-set failure, then retries without losing movement', async () => {
    const database = setup();
    database.sqlite.exec("INSERT INTO stats_snapshots(vtuber_id,followers,total_views,video_count,recorded_at) VALUES (1,30,300,3,'2026-09-01T09:00:00.000Z'),(2,10,100,1,'2026-09-01T09:00:00.000Z')");
    const insert = database.sqlite.prepare("INSERT INTO rankings(vtuber_id,period,category,month,rank,score,rank_change) VALUES (?,?,?,?,?,?,?)");
    for (const period of ['monthly', 'alltime']) for (const category of ['followers', 'views', 'videos']) {
      insert.run(1, period, category, period === 'monthly' ? '2026-09-01' : null, 1, 30, 2);
      insert.run(2, period, category, period === 'monthly' ? '2026-09-01' : null, 2, 10, -2);
    }
    const publicRows = () => database.sqlite.prepare('SELECT vtuber_id,period,category,month,rank,score,rank_change FROM rankings ORDER BY period,category,vtuber_id').all();
    const before = publicRows();
    database.injectFailure(call => /INSERT INTO (rankings|ranking_publication_rows)/.test(call.sql) && call.values.includes('alltime') && call.values.includes('videos'));
    await expect(run(database)).rejects.toThrow('การอัปเดตหรือเผยแพร่อันดับไม่สำเร็จ');
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(2);
    expect(publicRows()).toEqual(before);
    database.injectFailure(null);
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 2, rankingsPublished: 6 });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(4);
    expect(database.sqlite.prepare("SELECT vtuber_id,rank_change FROM rankings WHERE period='alltime' AND category='followers' ORDER BY vtuber_id").all()).toEqual([{ vtuber_id: 1, rank_change: -1 }, { vtuber_id: 2, rank_change: 1 }]);
    const publishedRun = database.sqlite.prepare("SELECT id FROM ranking_pipeline_runs WHERE status='succeeded'").get();
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots WHERE pipeline_run_id=?').get(publishedRun.id).count).toBe(2);
    await expect(run(database)).resolves.toMatchObject({ ok: true, skipped: 'not due' });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(4);
  });
  it('collects 151 channels in API batches of at most 50 and publishes the entire eligible population', async () => {
    const database = setup({ count: 151 });
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 151, rankingsPublished: 6 });
    expect(database.network).toHaveBeenCalledTimes(4);
    expect(database.network.mock.calls.map(([url]) => new URL(url).searchParams.get('id').split(',').length)).toEqual([50, 50, 50, 1]);
    expect(database.sqlite.prepare("SELECT COUNT(*) AS count FROM rankings WHERE period='alltime' AND category='followers'").get().count).toBe(151);
    expect(database.calls.filter(call => call.sql.includes('INSERT INTO ranking_publication_rows'))).toHaveLength(6);
  });
  it('opens the quota circuit immediately and never persists secret-bearing upstream diagnostics', async () => {
    const database = setup({ count: 101 });
    database.network.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: { message: 'https://example.invalid/?key=synthetic-test-key', errors: [{ reason: 'quotaExceeded' }] } }) });
    const result = await run(database);
    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0 });
    expect(database.network).toHaveBeenCalledTimes(1);
    expect(result.errors).toHaveLength(101);
    expect(result.errors[0].reason).toBe('YouTube quota exhausted');
    expect(JSON.stringify(database.sqlite.prepare('SELECT errors_json,error_summary FROM ranking_pipeline_runs').all())).not.toContain('synthetic-test-key');
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(0);
  });
  it('bounds hanging requests including JSON decoding with timeout and a finite retry budget', async () => {
    const database = setup({ count: 1 });
    database.network.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    let finished;
    run(database).then(result => { finished = result; });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(finished).toMatchObject({ ok: false, status: 'partial', updated: 0 });
    expect(database.network).toHaveBeenCalledTimes(3);
    expect(finished.errors).toEqual([{ vtuber_id: 1, reason: 'YouTube request timed out' }]);
    expect(database.network.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  });
  it('publishes only configured active supported metrics and records the expected set count', async () => {
    const database = setup();
    database.sqlite.exec("UPDATE categories SET status='inactive' WHERE id IN ('views','videos')");
    await expect(run(database)).resolves.toMatchObject({ ok: true, rankingsPublished: 2 });
    expect(database.sqlite.prepare('SELECT DISTINCT category FROM rankings').all()).toEqual([{ category: 'followers' }]);
    expect(database.sqlite.prepare('SELECT rankings_expected,rankings_published FROM ranking_pipeline_runs').get()).toEqual({ rankings_expected: 2, rankings_published: 2 });
  });
  it('collects monthly by Bangkok calendar slots so January 31, February 28 and March 2 all have archives', async () => {
    const database = setup({ frequency: 'monthly', time: '2027-01-31T09:00:00.000Z' });
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 2 });
    vi.setSystemTime(new Date('2027-02-28T09:00:00.000Z'));
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 2 });
    vi.setSystemTime(new Date('2027-03-02T09:00:00.000Z'));
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 2 });
    expect(database.sqlite.prepare("SELECT DISTINCT month FROM rankings WHERE period='monthly' ORDER BY month").all()).toEqual([{ month: '2027-01-01' }, { month: '2027-02-01' }, { month: '2027-03-01' }]);
  });
  it('finalizes a Thai calendar month even when collection is not due, without inventing snapshots or resetting alltime movement', async () => {
    const database = setup({ frequency: 'daily', time: '2027-01-31T16:00:00.000Z' });
    await run(database);
    const before = database.sqlite.prepare("SELECT vtuber_id,rank,rank_change,calculated_at FROM rankings WHERE period='alltime' ORDER BY category,vtuber_id").all();
    vi.setSystemTime(new Date('2027-01-31T17:00:00.000Z'));
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 0, rankingsPublished: 6 });
    expect(database.network).toHaveBeenCalledTimes(1);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(2);
    expect(database.sqlite.prepare("SELECT DISTINCT month FROM rankings WHERE period='monthly' ORDER BY month").all()).toEqual([{ month: '2027-01-01' }, { month: '2027-02-01' }]);
    expect(database.sqlite.prepare('SELECT month FROM ranking_month_finalizations').all()).toEqual([{ month: '2027-01-01' }]);
    expect(database.sqlite.prepare("SELECT vtuber_id,rank,rank_change,calculated_at FROM rankings WHERE period='alltime' ORDER BY category,vtuber_id").all()).toEqual(before);
    await expect(run(database)).resolves.toMatchObject({ ok: true, skipped: 'not due' });
  });
  it('uses the collected valid YouTube population and never repairs malformed IDs or republishes stale Twitch rows', async () => {
    const database = setup({ count: 4 });
    database.sqlite.exec("UPDATE vtubers SET platform='twitch' WHERE id=2; UPDATE vtubers SET platform=NULL WHERE id=4; UPDATE vtubers SET youtube_url=channel_url||'x',channel_url=channel_url||'x' WHERE id=3; INSERT INTO stats_snapshots(vtuber_id,followers,recorded_at) VALUES (2,9999,'2026-09-01T09:00:00.000Z'),(3,9999,'2026-09-01T09:00:00.000Z')");
    await expect(run(database)).resolves.toMatchObject({ ok: true, updated: 2, errors: [{ vtuber_id: 3, reason: 'no YouTube channel ID' }] });
    expect(database.sqlite.prepare("SELECT vtuber_id FROM rankings WHERE period='alltime' AND category='followers' ORDER BY vtuber_id").all()).toEqual([{ vtuber_id: 1 }, { vtuber_id: 4 }]);
  });
  it.each([null, 7])('recovers a crashed owner and closes its stale running ledger (fence %j)', async fence => {
    const database = setup();
    database.sqlite.prepare("INSERT INTO ranking_pipeline_runs(id,trigger_source,frequency,status,started_at,fence_token) VALUES ('crashed','scheduled','hourly','running',datetime('now','-181 seconds'),?)").run(fence);
    database.sqlite.exec("UPDATE ranking_pipeline_lease SET owner='crashed-owner',fence=7,expires_at=0");
    await expect(run(database)).resolves.toMatchObject({ ok: true, status: 'succeeded' });
    expect(database.sqlite.prepare("SELECT status,error_summary FROM ranking_pipeline_runs WHERE id='crashed'").get()).toEqual({ status: 'failed', error_summary: 'Updater lease expired' });
    expect(database.sqlite.prepare('SELECT owner,fence,expires_at FROM ranking_pipeline_lease').get()).toEqual({ owner: null, fence: 8, expires_at: 0 });
  });
  it('rejects malformed statistic types rather than fabricating numeric observations', async () => {
    const database = setup({ count: 1 });
    database.network.mockImplementation(async url => ({ ok: true, json: async () => ({ items: [{ id: new URL(url).searchParams.get('id'), statistics: { subscriberCount: true, viewCount: '1', videoCount: '1' } }] }) }));
    await expect(run(database)).resolves.toMatchObject({ ok: false, status: 'partial', updated: 0, errors: [{ vtuber_id: 1, reason: 'YouTube returned invalid statistics' }] });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(0);
  });

  it('keeps the previous publication when subscriber counts are hidden and recovers on a valid retry', async () => {
    const database = setup({ count: 1 });
    await run(database);
    const before = database.sqlite.prepare('SELECT * FROM rankings ORDER BY id').all();
    vi.setSystemTime(new Date('2026-09-01T11:00:00.000Z'));
    const validResponse = database.network.getMockImplementation();
    database.network.mockImplementation(async url => ({ ok: true, json: async () => ({ items: [{
      id: new URL(url).searchParams.get('id'),
      statistics: { hiddenSubscriberCount: true, subscriberCount: '100', viewCount: '200', videoCount: '3' },
    }] }) }));
    const result = await run(database);
    expect(result).toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0,
      errors: [{ vtuber_id: 1, reason: 'YouTube subscriber count is hidden' }] });
    expect(database.sqlite.prepare('SELECT * FROM rankings ORDER BY id').all()).toEqual(before);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(1);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM ranking_pipeline_snapshots WHERE run_id=?').get(result.runId).count).toBe(0);
    expect(database.sqlite.prepare('SELECT status FROM ranking_pipeline_runs WHERE id=?').get(result.runId).status).toBe('partial');
    database.network.mockImplementation(validResponse);
    await expect(run(database)).resolves.toMatchObject({ ok: true, status: 'succeeded', updated: 1, rankingsPublished: 6 });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM stats_snapshots').get().count).toBe(2);
  });

  it.each(['subscriberCount', 'viewCount', 'videoCount'].flatMap(field => [undefined, null].map(value => [field, value])))('does not stage or publish any channels when one has incomplete %s=%s', async (field, value) => {
    const database = setup();
    database.network.mockImplementation(async url => ({ ok: true, json: async () => ({ items: new URL(url).searchParams.get('id').split(',').map((id, index) => ({
      id, statistics: { subscriberCount: '10', viewCount: '200', videoCount: '3', ...(index === 0 && { [field]: value }) },
    })) }) }));
    await expect(run(database)).resolves.toMatchObject({ ok: false, status: 'partial', updated: 0, rankingsPublished: 0,
      errors: [{ vtuber_id: 1, reason: 'YouTube returned incomplete statistics' }] });
    for (const table of ['stats_snapshots', 'ranking_pipeline_snapshots', 'rankings', 'ranking_publications']) {
      expect(database.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count).toBe(0);
    }
  });
});
