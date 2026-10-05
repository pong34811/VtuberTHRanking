import { currentMonth } from '../frontend/server/ranking-period.js';
import { rankingGenerationStatement } from '../frontend/server/ranking-service.js';
import { latestSnapshotOrder, rankingEligibility } from '../shared/snapshot-policy.js';
import { readYouTubeStatistics } from '../shared/youtube-statistics.js';
import { syncDirectory } from './directory-sync.js';

// Cron slots, not completion times, drive collection. Monthly uses Thai calendar months.
const INTERVALS = { manual: 0, hourly: 3600, daily: 86400, weekly: 604800, monthly: 2592000 };
const metricCategories = ['followers', 'views', 'videos'];
async function enabledMetrics(db) {
  try {
    const { results = [] } = await db.prepare('SELECT id,status FROM categories ORDER BY sort_order,id').all();
    return results.filter(row => row.status === 'active' && metricCategories.includes(row.id)).map(row => row.id);
  } catch (error) {
    if (/no such table: categories/i.test(error?.message || '')) return metricCategories;
    throw error;
  }
}

// Carry forward real observations as-of month end, never invent new samples.
// Bound catch-up to three months per invocation; later cron calls continue it.
async function pendingArchives(db, targetMonth, population) {
  const { results = [] } = await db.prepare(`WITH RECURSIVE months(month) AS (
    SELECT strftime('%Y-%m-01',MIN(julianday(s.recorded_at)),'+7 hours')
      FROM stats_snapshots s JOIN vtubers v ON v.id=s.vtuber_id
      WHERE ${rankingEligibility()} AND v.id IN (SELECT value FROM json_each(?))
    UNION ALL SELECT date(month,'+1 month') FROM months WHERE date(month,'+1 month')<?
  ) SELECT month FROM months WHERE month<? AND NOT EXISTS
    (SELECT 1 FROM ranking_month_finalizations f WHERE f.month=months.month)
    ORDER BY month LIMIT 3`).bind(JSON.stringify(population), targetMonth, targetMonth).all();
  return results.map(row => row.month);
}

const completeRun = (db, run, result) => db.prepare(
  'UPDATE ranking_pipeline_runs SET status=?,completed_at=?,channels_total=?,snapshots_written=?,rankings_published=?,errors_json=?,error_summary=? WHERE id=? AND fence_token=?',
).bind(result.status, new Date().toISOString(), result.channelsTotal, result.snapshotsWritten, result.rankingsPublished, JSON.stringify(result.errors), result.errorSummary, run.id, run.fence);

const assertLease = (db, lease) => db.prepare(`INSERT INTO ranking_pipeline_assertions(valid)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM ranking_pipeline_lease
    WHERE id=1 AND owner=? AND fence=? AND expires_at>unixepoch('now')) THEN 1 ELSE 0 END`).bind(lease.owner, lease.fence);

const fencedDatabase = (db, lease) => ({
  prepare: sql => db.prepare(sql),
  batch: statements => db.batch([assertLease(db, lease), ...statements, db.prepare('DELETE FROM ranking_pipeline_assertions')]),
});

function safeFailure(error) {
  if (error?.code === 'RANKING_CHANNEL_LIMIT') return error.message;
  if (error?.code === 'NO_ACTIVE_CHANNELS') return 'ไม่มีช่องที่เปิดใช้งาน';
  if (error?.code === 'YOUTUBE_KEY_MISSING') return 'ยังไม่ได้ตั้งค่า YouTube API Key';
  return 'การอัปเดตหรือเผยแพร่อันดับไม่สำเร็จ';
}

function channelId(channel) {
  for (const value of [channel.youtube_url, channel.channel_url]) {
    try {
      const url = new URL(value);
      if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) continue;
      const id = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
      if (id) return id;
    } catch { /* Invalid/handle URLs are excluded, never repaired. */ }
  }
  return null;
}

function channelFailure(id, reason) {
  return { vtuber_id: id, reason };
}

async function youtubeBatch(ids, key, budget) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'statistics'); url.searchParams.set('id', ids.join(',')); url.searchParams.set('key', key);
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = budget.deadline - Date.now();
    if (remaining <= 0) return { reason: 'YouTube collection deadline exceeded', stop: true };
    if (budget.requests >= 40) return { reason: 'YouTube request budget exhausted', stop: true };
    budget.requests++;
    const controller = new AbortController();
    let timer;
    let result;
    let retryAfter = 0;
    try {
      const operation = (async () => {
        const response = await fetch(url, { signal: controller.signal, headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } });
        let body;
        try { body = await response.json(); } catch { body = null; }
        if (response.ok) return { items: body?.items };
        const reasons = Array.isArray(body?.error?.errors) ? body.error.errors.map(error => error?.reason) : [];
        if (response.status === 403 && reasons.some(reason => ['quotaExceeded', 'dailyLimitExceeded'].includes(reason))) return { reason: 'YouTube quota exhausted', stop: true };
        if ([401, 403].includes(response.status)) return { reason: 'YouTube authorization failed', stop: true };
        const seconds = Number(response.headers?.get('Retry-After'));
        retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 1000) : 0;
        return { reason: `YouTube API returned ${Number(response.status) || 0}`, retry: response.status === 429 || response.status >= 500 };
      })();
      result = await Promise.race([operation, new Promise(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve({ reason: 'YouTube request timed out', retry: true }); }, Math.min(8000, remaining));
      })]);
    } catch { result = { reason: 'YouTube request failed', retry: true }; }
    finally { clearTimeout(timer); }
    if (!result.retry || attempt === 2) return result;
    const delay = Math.min(Math.max(250 * 2 ** attempt, retryAfter), Math.max(0, budget.deadline - Date.now()));
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

async function matchesSecret(provided, expected) {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedDigest, expectedDigest);
}

export async function updateAll(env, force = false, metadata = {}) {
  const capturedTime = Number.isFinite(metadata.scheduledTime) ? metadata.scheduledTime : Date.now();
  const capturedAt = new Date(capturedTime).toISOString();
  const frequency = (await env.DB.prepare("SELECT setting_value FROM settings WHERE setting_key='ranking_update_frequency'").first())?.setting_value || 'manual';
  const triggerSource = metadata.triggerSource === 'manual' ? 'manual' : 'scheduled';
  if (frequency === 'manual' && (triggerSource === 'scheduled' || !force)) return { ok: true, skipped: 'manual', freq: frequency };
  const interval = INTERVALS[frequency];
  if (!interval && frequency !== 'manual') return { ok: true, skipped: 'invalid frequency', freq: frequency };
  const { results: eligible = [] } = await env.DB.prepare(`SELECT v.id,v.platform,v.youtube_url,v.channel_url FROM vtubers v WHERE ${rankingEligibility()} ORDER BY v.id`).all();
  const youtubeChannels = eligible.map(channel => ({ ...channel, youtubeId: channelId(channel) }));
  const channels = youtubeChannels.filter(channel => channel.youtubeId);
  const skippedChannels = youtubeChannels.filter(channel => !channel.youtubeId)
    .map(channel => channelFailure(channel.id, 'no YouTube channel ID'));
  if (!youtubeChannels.length && (await env.DB.prepare('SELECT COUNT(*) AS count FROM vtubers WHERE is_active=1').first())?.count) {
    return { ok: true, skipped: 'no YouTube channels', freq: frequency };
  }
  const owner = crypto.randomUUID();
  const acquired = await env.DB.prepare(`UPDATE ranking_pipeline_lease SET owner=?,fence=fence+1,expires_at=unixepoch('now')+180
    WHERE id=1 AND expires_at<=unixepoch('now') AND NOT EXISTS (
      SELECT 1 FROM ranking_pipeline_runs WHERE status='running' AND fence_token IS NULL
        AND julianday(started_at)>julianday('now','-180 seconds')) RETURNING fence`).bind(owner).first();
  if (!acquired) return { ok: true, skipped: 'in progress', freq: frequency };
  const lease = { owner, fence: acquired.fence };
  const db = fencedDatabase(env.DB, lease);
  let run;
  try {
    await db.batch([db.prepare(`UPDATE ranking_pipeline_runs SET status='failed',completed_at=?,
      error_summary='Updater lease expired',errors_json='[{"reason":"Updater lease expired"}]'
      WHERE status='running' AND (fence_token IS NULL OR fence_token<?)`).bind(new Date(Date.now()).toISOString(), lease.fence)]);
    // Recheck due/idempotency under the lease, not before acquiring it.
    const lastSuccess = await db.prepare("SELECT slot_at,started_at,completed_at FROM ranking_pipeline_runs WHERE status='succeeded' AND collection_due=1 ORDER BY julianday(completed_at) DESC,id DESC LIMIT 1").first();
    const lastTime = Date.parse(lastSuccess?.slot_at || lastSuccess?.started_at || lastSuccess?.completed_at || '');
    const slotAt = frequency === 'monthly' ? new Date(`${currentMonth(capturedTime)}-01T00:00:00+07:00`).toISOString()
      : interval ? new Date(Math.floor(capturedTime / (interval * 1000)) * interval * 1000).toISOString() : capturedAt;
    let slotKey = force ? `manual:${owner}` : `${frequency}:${slotAt}`;
    let existing = await db.prepare('SELECT * FROM ranking_pipeline_runs WHERE slot_key=?').bind(slotKey).first();
    const due = !Number.isFinite(lastTime) || (frequency === 'monthly' ? currentMonth(capturedTime) > currentMonth(lastTime)
      : Math.floor(capturedTime / (interval * 1000)) > Math.floor(lastTime / (interval * 1000)));
    const targetMonth = `${currentMonth(capturedTime)}-01`;
    let collectDue = force || (existing ? existing.status !== 'succeeded' : due);
    let archives = await pendingArchives(db, targetMonth, channels.map(channel => channel.id));
    if (!collectDue) {
      const currentPublication = await db.prepare(`SELECT 1 AS present FROM rankings WHERE period='monthly' AND month=?
        UNION ALL SELECT 1 FROM ranking_publications WHERE target_month=? LIMIT 1`).bind(targetMonth, targetMonth).first();
      if (!archives.length && currentPublication) return { ok: true, skipped: 'not due', freq: frequency, last_run: lastSuccess?.completed_at };
      slotKey = `archive:${targetMonth}:${archives.join(',') || 'current'}`;
      existing = await db.prepare('SELECT * FROM ranking_pipeline_runs WHERE slot_key=?').bind(slotKey).first();
    }
    if (existing?.stage_ready) { collectDue = !!existing.collection_due; archives = JSON.parse(existing.archives_json); }
    run = {
      id: existing?.id || crypto.randomUUID(), triggerSource, frequency, fence: lease.fence,
      slotKey, slotAt, startedAt: existing?.started_at || capturedAt,
      targetMonth: existing?.target_month || targetMonth,
      observedAt: existing?.stage_ready ? existing.observed_at : new Date(Date.now()).toISOString(),
    };
    const metrics = existing?.stage_ready ? JSON.parse(existing.metrics_json) : await enabledMetrics(db);
    await db.batch([db.prepare(`INSERT INTO ranking_pipeline_runs
      (id,trigger_source,frequency,status,started_at,fence_token,slot_key,slot_at,target_month,observed_at,channels_total,metrics_json,rankings_expected,collection_due,archives_json)
      VALUES (?,?,?,'running',?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status='running',fence_token=excluded.fence_token,completed_at=NULL,observed_at=excluded.observed_at,metrics_json=excluded.metrics_json,rankings_expected=excluded.rankings_expected,archives_json=excluded.archives_json`)
      .bind(run.id, triggerSource, frequency, run.startedAt, run.fence, slotKey, slotAt, run.targetMonth, run.observedAt, youtubeChannels.length,
        JSON.stringify(metrics), metrics.length * (archives.length + 1 + Number(collectDue)), Number(collectDue), JSON.stringify(archives))]);
    if (collectDue && !env.YOUTUBE_API_KEY && !existing?.stage_ready) throw Object.assign(new Error(), { code: 'YOUTUBE_KEY_MISSING' });
    if (!youtubeChannels.length) throw Object.assign(new Error(), { code: 'NO_ACTIVE_CHANNELS' });
    const snapshots = [];
    const errors = [];
    if (!existing?.stage_ready && collectDue) {
      const byYoutubeId = new Map();
      for (const channel of channels) {
        if (!byYoutubeId.has(channel.youtubeId)) byYoutubeId.set(channel.youtubeId, []);
        byYoutubeId.get(channel.youtubeId).push(channel);
      }
      const ids = [...byYoutubeId.keys()];
      const budget = { deadline: Date.now() + 60_000, requests: 0 };
      for (let offset = 0; offset < ids.length; offset += 50) {
        const batchIds = ids.slice(offset, offset + 50);
        const batchChannels = batchIds.flatMap(id => byYoutubeId.get(id));
        try {
          const response = await youtubeBatch(batchIds, env.YOUTUBE_API_KEY, budget);
          if (response.reason) {
            errors.push(...batchChannels.map(channel => channelFailure(channel.id, response.reason)));
            if (response.stop) {
              errors.push(...ids.slice(offset + 50).flatMap(id => byYoutubeId.get(id)).map(channel => channelFailure(channel.id, response.reason)));
              break;
            }
            continue;
          }
          const items = response.items;
          const statsById = new Map((Array.isArray(items) ? items : []).map(item => [item.id, item.statistics]));
          for (const channel of batchChannels) {
            const stats = readYouTubeStatistics(statsById.get(channel.youtubeId));
            if (!stats.ok) { errors.push(channelFailure(channel.id, stats.reason)); continue; }
            snapshots.push({ vtuber_id: channel.id, followers: stats.followers, total_views: stats.total_views, video_count: stats.video_count, recorded_at: run.observedAt });
          }
        } catch { errors.push(...batchChannels.map(channel => channelFailure(channel.id, 'YouTube request failed'))); }
      }
      if (errors.length || !channels.length) {
        const allErrors = [...skippedChannels, ...errors];
        const result = { status: 'partial', channelsTotal: youtubeChannels.length, snapshotsWritten: 0, rankingsPublished: 0,
          errors: allErrors, errorSummary: errors.length ? `${errors.length} ช่องดึงสถิติไม่สำเร็จ จึงยังไม่เผยแพร่อันดับ` : `ข้าม ${skippedChannels.length} ช่องที่ไม่มี YouTube channel ID` };
        await db.batch([completeRun(db, run, result)]);
        return { ok: false, runId: run.id, status: 'partial', updated: 0, rankingsPublished: 0, errors: allErrors };
      }
      await db.batch([db.prepare('DELETE FROM ranking_pipeline_snapshots WHERE run_id=?').bind(run.id)]);
      for (let index = 0; index < snapshots.length; index += 100) {
        await db.batch([db.prepare(`INSERT INTO ranking_pipeline_snapshots(run_id,vtuber_id,followers,total_views,video_count,recorded_at)
          SELECT ?,json_extract(value,'$.vtuber_id'),json_extract(value,'$.followers'),json_extract(value,'$.total_views'),
            json_extract(value,'$.video_count'),json_extract(value,'$.recorded_at') FROM json_each(?)`)
          .bind(run.id, JSON.stringify(snapshots.slice(index, index + 100)))]);
      }
    }
    if (!existing?.stage_ready) {
      if (!collectDue) await db.batch([db.prepare(`INSERT INTO ranking_pipeline_snapshots(run_id,vtuber_id,followers,total_views,video_count,recorded_at)
        SELECT ?,v.id,s.followers,s.total_views,s.video_count,s.recorded_at FROM vtubers v
        JOIN stats_snapshots s ON s.id=(SELECT ss.id FROM stats_snapshots ss WHERE ss.vtuber_id=v.id AND julianday(ss.recorded_at)<=julianday(?)
          ORDER BY ${latestSnapshotOrder('ss')} LIMIT 1)
        WHERE ${rankingEligibility()} AND v.id IN (SELECT value FROM json_each(?))
        ON CONFLICT(run_id,vtuber_id) DO UPDATE SET followers=excluded.followers,total_views=excluded.total_views,video_count=excluded.video_count,recorded_at=excluded.recorded_at`)
        .bind(run.id, run.observedAt, JSON.stringify(channels.map(channel => channel.id)))]);
      await db.batch([db.prepare('UPDATE ranking_pipeline_runs SET stage_ready=1 WHERE id=? AND fence_token=?').bind(run.id, run.fence)]);
    }
    const stagedCount = (await db.prepare('SELECT COUNT(*) AS count FROM ranking_pipeline_snapshots WHERE run_id=?').bind(run.id).first()).count;
    const snapshotsWritten = collectDue ? stagedCount : 0;
    const periods = [...archives.map(month => ({ period: 'monthly', month })), { period: 'monthly', month: run.targetMonth },
      ...(collectDue ? [{ period: 'alltime', month: null }] : [])];
    const sets = periods.flatMap(period => metrics.map(category => ({ ...period, category })));
    const rankingsPublished = sets.length;
    const publicationId = run.id;
    const result = {
      status: 'succeeded', channelsTotal: youtubeChannels.length, snapshotsWritten, rankingsPublished,
      errors: skippedChannels,
      errorSummary: skippedChannels.length ? `ข้าม ${skippedChannels.length} ช่องที่ไม่มี YouTube channel ID` : '',
    };
    await db.batch([
      db.prepare('INSERT INTO ranking_publications(id,run_id,target_month,published_at,rankings_expected) VALUES (?,?,?,?,?)')
        .bind(publicationId, run.id, run.targetMonth, new Date(Date.now()).toISOString(), rankingsPublished),
      ...(collectDue ? [db.prepare(`INSERT INTO stats_snapshots(vtuber_id,followers,total_views,video_count,avg_views,recorded_at,pipeline_run_id,collection_slot)
        SELECT vtuber_id,followers,total_views,video_count,0,recorded_at,?,? FROM ranking_pipeline_snapshots WHERE run_id=?`).bind(run.id, run.slotKey, run.id)] : []),
      ...sets.map(filter => rankingGenerationStatement(db, publicationId, filter, { runId: run.id, asOf: run.observedAt })),
      db.prepare(`DELETE FROM rankings WHERE EXISTS (SELECT 1 FROM json_each(?)
        WHERE rankings.period=json_extract(value,'$.period') AND rankings.month IS json_extract(value,'$.month'))`).bind(JSON.stringify(periods)),
      db.prepare(`INSERT INTO rankings(vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at)
        SELECT vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at FROM ranking_publication_rows WHERE publication_id=?`).bind(publicationId),
      ...archives.map(month => db.prepare('INSERT INTO ranking_month_finalizations(month,publication_id,finalized_at) VALUES (?,?,?)').bind(month, publicationId, new Date(Date.now()).toISOString())),
      completeRun(db, run, result),
    ]);
    return { ok: true, runId: run.id, status: 'succeeded', updated: snapshotsWritten, rankingsPublished, errors: skippedChannels };
  } catch (error) {
    const summary = safeFailure(error);
    if (run) await completeRun(env.DB, run, { status: 'failed', channelsTotal: youtubeChannels.length, snapshotsWritten: 0, rankingsPublished: 0,
      errors: [{ reason: summary }], errorSummary: summary }).run();
    throw Object.assign(new Error(summary), { code: error?.code });
  } finally {
    await env.DB.prepare('UPDATE ranking_pipeline_lease SET owner=NULL,expires_at=0 WHERE id=1 AND owner=? AND fence=?').bind(owner, lease.fence).run();
  }
}

export default {
  // Bearer-token-gated endpoint for a manager-initiated refresh.
  async fetch(request, env) {
    if (request.method !== 'POST') return Response.json({ ok: false }, { status: 405, headers: { Allow: 'POST' } });
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!env.UPDATER_RUN_TOKEN || !token || !await matchesSecret(token, env.UPDATER_RUN_TOKEN)) {
      return Response.json({ ok: false }, { status: 403 });
    }
    const url = new URL(request.url);
    const result = await updateAll(env, url.searchParams.get('force') === '1', { triggerSource: 'manual' });
    return Response.json(result);
  },
  async scheduled(controller, env) {
    // Directory failures must not prevent the statistics pipeline from running.
    try { await syncDirectory(env, { scheduledTime: controller.scheduledTime }); }
    catch { console.error('Directory sync failed'); }
    await updateAll(env, false, { triggerSource: 'scheduled', scheduledTime: controller.scheduledTime });
  },
};
