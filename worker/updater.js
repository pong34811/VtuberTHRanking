// ponytail: worker ตัวเล็กดึงสถิติ YouTube ทุกช่องตามรอบใน settings (ranking_update_frequency)
const INTERVALS = { manual: 0, hourly: 3600, daily: 86400, weekly: 604800, monthly: 2592000 };

async function updateAll(env, force = false) {
  const freq = (await env.DB.prepare("SELECT setting_value FROM settings WHERE setting_key='ranking_update_frequency'").first())?.setting_value || 'manual';
  if (freq === 'manual' || !INTERVALS[freq]) return { ok: true, skipped: 'manual', freq };
  const last = await env.DB.prepare('SELECT MAX(recorded_at) AS last_run FROM stats_snapshots').first();
  const lastTs = last?.last_run ? Date.parse(last.last_run) : 0;
  if (!force && Date.now() - lastTs < INTERVALS[freq] * 1000) return { ok: true, skipped: 'not due', freq, last_run: last?.last_run };
  const { results } = await env.DB.prepare('SELECT id, youtube_url, channel_url FROM vtubers WHERE is_active=1').all();
  const now = new Date().toISOString();
  let updated = 0;
  const errors = [];
  for (const v of results || []) {
    const m = `${v.youtube_url || ''} ${v.channel_url || ''}`.match(/(UC[\w-]{22})/);
    if (!m) { errors.push({ id: v.id, reason: 'no channel id' }); continue; }
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${m[1]}&key=${encodeURIComponent(env.YOUTUBE_API_KEY)}`, { headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } });
      if (!res.ok) throw new Error('youtube ' + res.status);
      const st = (await res.json()).items?.[0]?.statistics || {};
      await env.DB.prepare('INSERT INTO stats_snapshots (vtuber_id,followers,total_views,video_count,avg_views,recorded_at) VALUES (?,?,?,?,0,?)')
        .bind(v.id, Number(st.subscriberCount || 0), Number(st.viewCount || 0), Number(st.videoCount || 0), now).run();
      updated += 1;
    } catch (e) { errors.push({ id: v.id, reason: e?.message }); }
  }
  return { ok: true, freq, updated, errors, at: now };
}

export default {
  // ponytail: ?run=<YOUTUBE_API_KEY> ใช้รันมือ/เทส คนอื่นยิงเล่นไม่ได้เพราะไม่รู้คีย์
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.searchParams.get('run') !== env.YOUTUBE_API_KEY) return Response.json({ ok: false }, { status: 403 });
    return Response.json(await updateAll(env, url.searchParams.get('force') === '1'));
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(updateAll(env).catch(e => ({ ok: false, reason: e?.message })));
  },
};
