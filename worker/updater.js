import { currentMonth } from '../frontend/server/ranking-period.js';
import { calculateRanking } from '../frontend/server/ranking-service.js';

// Frequency settings are stored as seconds. Cron runs hourly and retries failed runs.
const INTERVALS = { manual: 0, hourly: 3600, daily: 86400, weekly: 604800, monthly: 2592000 };
const metricCategories = ['followers', 'views', 'videos'];
const periods = () => [
  { period: 'monthly', month: `${currentMonth()}-01` },
  { period: 'alltime', month: null },
];

const prepareRun = (db, run) => db.prepare(
  'INSERT INTO ranking_pipeline_runs (id,trigger_source,frequency,status,started_at,channels_total,snapshots_written,rankings_published,errors_json,error_summary) VALUES (?,?,?,\'running\',?,0,0,0,\'[]\',\'\')',
).bind(run.id, run.triggerSource, run.frequency, run.startedAt);

const completeRun = (db, runId, result) => db.prepare(
  'UPDATE ranking_pipeline_runs SET status=?,completed_at=?,channels_total=?,snapshots_written=?,rankings_published=?,errors_json=?,error_summary=? WHERE id=?',
).bind(result.status, new Date().toISOString(), result.channelsTotal, result.snapshotsWritten, result.rankingsPublished, JSON.stringify(result.errors), result.errorSummary, runId);

function safeFailure(error) {
  if (error?.code === 'RANKING_CHANNEL_LIMIT') return error.message;
  if (error?.code === 'NO_ACTIVE_CHANNELS') return 'ไม่มีช่องที่เปิดใช้งาน';
  if (error?.code === 'YOUTUBE_KEY_MISSING') return 'ยังไม่ได้ตั้งค่า YouTube API Key';
  return 'การอัปเดตหรือเผยแพร่อันดับไม่สำเร็จ';
}

function channelId(channel) {
  return `${channel.youtube_url || ''} ${channel.channel_url || ''}`.match(/(UC[\w-]{22})/)?.[1] || null;
}

function channelFailure(id, reason) {
  return { vtuber_id: id, reason };
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
  const frequency = (await env.DB.prepare("SELECT setting_value FROM settings WHERE setting_key='ranking_update_frequency'").first())?.setting_value || 'manual';
  const triggerSource = metadata.triggerSource === 'manual' ? 'manual' : 'scheduled';
  if (frequency === 'manual' && (triggerSource === 'scheduled' || !force)) return { ok: true, skipped: 'manual', freq: frequency };
  const interval = INTERVALS[frequency];
  if (!interval && frequency !== 'manual') return { ok: true, skipped: 'invalid frequency', freq: frequency };

  const lastSuccess = frequency === 'manual'
    ? null
    : await env.DB.prepare("SELECT completed_at FROM ranking_pipeline_runs WHERE status='succeeded' ORDER BY completed_at DESC,id DESC LIMIT 1").first();
  const latestRun = frequency === 'manual'
    ? null
    : await env.DB.prepare('SELECT status,started_at FROM ranking_pipeline_runs ORDER BY started_at DESC,id DESC LIMIT 1').first();
  const lastTime = Date.parse(lastSuccess?.completed_at || '');
  const retryIncomplete = latestRun && latestRun.status !== 'succeeded';
  if (!force && frequency !== 'manual' && !retryIncomplete && Number.isFinite(lastTime) && Date.now() - lastTime < interval * 1000) {
    return { ok: true, skipped: 'not due', freq: frequency, last_run: lastSuccess.completed_at };
  }

  const run = {
    id: crypto.randomUUID(),
    triggerSource,
    frequency,
    startedAt: new Date().toISOString(),
  };
  await prepareRun(env.DB, run).run();

  let channelsTotal = 0;
  let snapshotsWritten = 0;
  let rankingsPublished = 0;
  let errors = [];
  try {
    if (!env.YOUTUBE_API_KEY) {
      const error = new Error('Missing YouTube API key');
      error.code = 'YOUTUBE_KEY_MISSING';
      throw error;
    }

    const { results = [] } = await env.DB.prepare('SELECT id,youtube_url,channel_url FROM vtubers WHERE is_active=1 ORDER BY id').all();
    channelsTotal = results.length;
    if (channelsTotal > 90) {
      const error = new Error('Ranking publication supports at most 90 channels per batch; no changes were saved');
      error.code = 'RANKING_CHANNEL_LIMIT';
      throw error;
    }
    if (!channelsTotal) {
      const error = new Error('No active channels');
      error.code = 'NO_ACTIVE_CHANNELS';
      throw error;
    }

    const now = new Date().toISOString();
    const snapshots = [];
    for (const channel of results) {
      const id = channelId(channel);
      if (!id) {
        errors.push(channelFailure(channel.id, 'no YouTube channel ID'));
        continue;
      }
      try {
        const url = new URL('https://www.googleapis.com/youtube/v3/channels');
        url.searchParams.set('part', 'statistics');
        url.searchParams.set('id', id);
        url.searchParams.set('key', env.YOUTUBE_API_KEY);
        const response = await fetch(url, { headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } });
        if (!response.ok) {
          errors.push(channelFailure(channel.id, `YouTube API returned ${response.status}`));
          continue;
        }
        const items = (await response.json()).items;
        if (!Array.isArray(items) || !items.length || !items[0]?.statistics) {
          errors.push(channelFailure(channel.id, 'YouTube returned no channel statistics'));
          continue;
        }
        const stats = items[0].statistics;
        const values = [Number(stats.subscriberCount || 0), Number(stats.viewCount || 0), Number(stats.videoCount || 0)];
        if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) {
          errors.push(channelFailure(channel.id, 'YouTube returned invalid statistics'));
          continue;
        }
        snapshots.push(env.DB.prepare('INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)').bind(channel.id, ...values, now));
      } catch {
        errors.push(channelFailure(channel.id, 'YouTube request failed'));
      }
    }

    if (errors.length) {
      const summary = `${errors.length} จาก ${channelsTotal} ช่องดึงสถิติไม่สำเร็จ จึงยังไม่เผยแพร่อันดับ`;
      const result = { status: 'partial', channelsTotal, snapshotsWritten: 0, rankingsPublished: 0, errors, errorSummary: summary };
      await completeRun(env.DB, run.id, result).run();
      return { ok: false, runId: run.id, status: result.status, updated: 0, rankingsPublished: 0, errors };
    }

    await env.DB.batch(snapshots);
    snapshotsWritten = snapshots.length;

    for (const period of periods()) {
      for (const category of metricCategories) {
        await calculateRanking(env.DB, { ...period, category });
        rankingsPublished += 1;
      }
    }

    const result = { status: 'succeeded', channelsTotal, snapshotsWritten, rankingsPublished, errors: [], errorSummary: '' };
    await completeRun(env.DB, run.id, result).run();
    return { ok: true, runId: run.id, status: result.status, updated: snapshotsWritten, rankingsPublished, errors: [] };
  } catch (error) {
    const summary = safeFailure(error);
    const result = {
      status: snapshotsWritten || rankingsPublished ? 'partial' : 'failed',
      channelsTotal,
      snapshotsWritten,
      rankingsPublished,
      errors: [{ reason: summary }],
      errorSummary: summary,
    };
    await completeRun(env.DB, run.id, result).run();
    const reported = new Error(summary);
    reported.code = error?.code;
    throw reported;
  }
}

export default {
  // API-key-gated endpoint for a manager-initiated refresh.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.YOUTUBE_API_KEY || !await matchesSecret(url.searchParams.get('run') || '', env.YOUTUBE_API_KEY)) {
      return Response.json({ ok: false }, { status: 403 });
    }
    const result = await updateAll(env, url.searchParams.get('force') === '1', { triggerSource: 'manual' });
    return Response.json(result);
  },
  async scheduled(controller, env) {
    await updateAll(env, false, { triggerSource: 'scheduled', scheduledTime: controller.scheduledTime });
  },
};
