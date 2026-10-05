import { readYouTubeStatistics } from '../shared/youtube-statistics.js';
import { youtubeReference, readYouTubeProfile, isIndependentThaiVTuber, youtubeChannelLookup as lookup } from '../shared/youtube-profile.js';

export const PIXELA_ROSTER = 'https://www.pixela.me/virtual-influencers';
const agencyName = 'Pixela Project';
const canonicalUrl = id => `https://www.youtube.com/channel/${id}`;

export async function readPixelaRoster(response) {
  const cards = [];
  let card;
  const html = await new HTMLRewriter().on('.wixui-repeater__item', {
    element(element) {
      card = { references: [], text: '' }; cards.push(card);
      element.onEndTag(() => { card = null; });
    },
    text(chunk) { if (card) card.text += chunk.text; },
  }).on('.wixui-repeater__item a[href]', {
    element(element) {
      const url = element.getAttribute('href');
      if (card && youtubeReference(url)) card.references.push(url);
    },
  }).transform(response).text();
  // ponytail: one verified roster layout; add an adapter when another official roster is verified.
  if (!cards.length || html.length > 1_000_000 || cards.length > 100) throw new Error('Official roster layout changed');
  return cards.flatMap(row => [...new Set(row.references)].map(url => ({ url, graduated: /\bgraduated\b/i.test(row.text) })));
}

async function youtube(env, query, budget, search = false) {
  if (++budget.requests > 40 || Date.now() >= budget.deadline) throw new Error('Directory request budget exhausted');
  const url = new URL(`https://www.googleapis.com/youtube/v3/${search ? 'search' : 'channels'}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set('part', search ? 'snippet' : 'snippet,statistics');
  url.searchParams.set('key', env.YOUTUBE_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(8000, Math.max(1, budget.deadline - Date.now()))), headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } });
  if (!response.ok) throw new Error('YouTube directory request failed');
  const body = await response.json();
  if (!Array.isArray(body?.items) || body.items.length > (search ? 10 : 50)) throw new Error('Invalid YouTube directory response');
  return body.items;
}

function profileStatements(db, row, channelId, profile, checkedAt) {
  const id = row.id;
  const references = JSON.stringify({ youtube_url: row.youtube_url || '', channel_url: row.channel_url || '' });
  return [
    db.prepare(`UPDATE vtubers SET
      name=CASE WHEN name='' OR name=(SELECT json_extract(profile_json,'$.name') FROM youtube_profile_state WHERE vtuber_id=vtubers.id) THEN ? ELSE name END,
      avatar=CASE WHEN avatar='' OR avatar=(SELECT json_extract(profile_json,'$.avatar') FROM youtube_profile_state WHERE vtuber_id=vtubers.id) THEN ? ELSE avatar END,
      bio=CASE WHEN bio='' OR bio=(SELECT json_extract(profile_json,'$.bio') FROM youtube_profile_state WHERE vtuber_id=vtubers.id) THEN ? ELSE bio END,
      updated_at=datetime(?) WHERE id=? AND is_active=1 AND COALESCE(youtube_url,'')=? AND COALESCE(channel_url,'')=?`)
      .bind(profile.name, profile.avatar, profile.bio, checkedAt, id, row.youtube_url || '', row.channel_url || ''),
    db.prepare(`INSERT INTO youtube_profile_state(vtuber_id,channel_id,profile_json,reference_json,source_url,checked_at)
      SELECT id,?,?,?,?,? FROM vtubers WHERE id=? AND is_active=1 AND COALESCE(youtube_url,'')=? AND COALESCE(channel_url,'')=?
      ON CONFLICT(vtuber_id) DO UPDATE SET channel_id=excluded.channel_id,profile_json=excluded.profile_json,reference_json=excluded.reference_json,source_url=excluded.source_url,checked_at=excluded.checked_at`)
      .bind(channelId, JSON.stringify(profile), references, canonicalUrl(channelId), checkedAt, id, row.youtube_url || '', row.channel_url || ''),
  ];
}

export async function syncDirectory(env, metadata = {}) {
  const enabled = await env.DB.prepare("SELECT setting_value FROM settings WHERE setting_key='directory_sync_enabled'").first();
  if (enabled?.setting_value !== 'true') return { ok: true, skipped: 'disabled' };
  const time = metadata.scheduledTime ?? Date.now();
  const day = new Date(time + 7 * 3600000).toISOString().slice(0, 10);
  const startedAt = new Date().toISOString();
  const owner = crypto.randomUUID();
  const lease = await env.DB.prepare(`UPDATE directory_sync_lease SET owner=?,fence=fence+1,expires_at=unixepoch('now')+180
    WHERE id=1 AND expires_at<=unixepoch('now') RETURNING fence`).bind(owner).first();
  if (!lease) return { ok: true, skipped: 'in progress' };
  const db = env.DB;
  const batch = statements => db.batch([
    db.prepare(`INSERT INTO ranking_pipeline_assertions(valid) SELECT CASE WHEN EXISTS
      (SELECT 1 FROM directory_sync_lease WHERE id=1 AND owner=? AND fence=? AND expires_at>unixepoch('now')) THEN 1 ELSE 0 END`).bind(owner, lease.fence),
    ...statements, db.prepare('DELETE FROM ranking_pipeline_assertions'),
  ]);
  let run;
  const result = { profilesChecked: 0, channelsAdded: 0, candidatesPending: 0 };
  const errors = [];
  try {
    const existingRun = await db.prepare('SELECT * FROM directory_sync_runs WHERE day=?').bind(day).first();
    if (existingRun?.status === 'succeeded') return { ok: true, skipped: 'not due' };
    run = existingRun?.id || owner;
    await batch([
      db.prepare("UPDATE directory_sync_runs SET status='failed',completed_at=?,error_summary='Directory lease expired' WHERE status='running'").bind(startedAt),
      db.prepare(`INSERT INTO directory_sync_runs(id,day,status,started_at) VALUES (?,?,'running',?)
        ON CONFLICT(day) DO UPDATE SET status='running',started_at=excluded.started_at,completed_at=NULL`).bind(run, day, startedAt),
    ]);
    if (!env.YOUTUBE_API_KEY) throw new Error('YouTube API key is not configured');
    const budget = { requests: 0, deadline: Date.now() + 60_000 };
    const { results: channels = [] } = await db.prepare(`SELECT v.id,v.youtube_url,v.channel_url,v.is_active,s.channel_id,s.reference_json FROM vtubers v
      LEFT JOIN youtube_profile_state s ON s.vtuber_id=v.id WHERE v.platform='youtube' OR v.platform IS NULL ORDER BY v.id`).all();
    const known = new Map();
    for (const row of channels) {
      const ref = youtubeReference(row.youtube_url) || youtubeReference(row.channel_url);
      if (row.channel_id && ref?.forHandle && row.reference_json === JSON.stringify({ youtube_url: row.youtube_url || '', channel_url: row.channel_url || '' })) ref.id = row.channel_id;
      if (ref?.id) { if (!known.has(ref.id)) known.set(ref.id, []); known.get(ref.id).push(row); }
      else if (ref?.forHandle) {
        try {
          const [item] = await youtube(env, ref, budget);
          if (!readYouTubeProfile(item)) throw new Error('Invalid channel profile');
          if (!known.has(item.id)) known.set(item.id, []); known.get(item.id).push(row);
        } catch { errors.push(`Channel ${row.id}: handle lookup failed`); }
      } else if (row.is_active) errors.push(`Channel ${row.id}: no usable YouTube reference`);
    }
    const ids = [...known.keys()];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const requested = ids.slice(offset, offset + 50);
      try {
        const items = await youtube(env, { id: requested.join(',') }, budget);
        const byId = new Map(items.map(item => [item.id, item]));
        for (const id of requested) {
          const profile = readYouTubeProfile(byId.get(id));
          if (!profile) { errors.push(`Channel ${id}: profile unavailable`); continue; }
          for (const row of known.get(id).filter(row => row.is_active)) {
            await batch(profileStatements(db, row, id, profile, startedAt)); result.profilesChecked++;
          }
        }
      } catch { errors.push('Existing channel profiles could not be refreshed'); }
    }
    const candidates = [];
    try {
      if (Date.now() >= budget.deadline) throw new Error('Directory time budget exhausted');
      const response = await fetch(PIXELA_ROSTER, { redirect: 'manual', signal: AbortSignal.timeout(Math.min(8000, budget.deadline - Date.now())) });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Official roster unavailable');
      const rows = await readPixelaRoster(response);
      if (!rows.length) throw new Error('Official roster has no channel references');
      candidates.push(...rows.map(row => ({ ...row, source: PIXELA_ROSTER, agency: true })));
    } catch { errors.push('Pixela official roster could not be checked'); }
    try {
      const items = await youtube(env, { q: 'Thai VTuber', type: 'channel', order: 'date', relevanceLanguage: 'th', maxResults: '10' }, budget, true);
      candidates.push(...items.filter(item => /^UC[A-Za-z0-9_-]{22}$/.test(item.id?.channelId || ''))
        .map(item => ({ url: canonicalUrl(item.id.channelId), source: canonicalUrl(item.id.channelId), agency: false })));
    } catch { errors.push('Independent channel search failed'); }
    const seen = new Set();
    for (const candidate of candidates) {
      const ref = youtubeReference(candidate.url);
      const key = ref?.id || ref?.forHandle?.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      try {
        const savedReference = await db.prepare("SELECT status FROM directory_candidates WHERE reference_url=? AND status IN ('imported','ignored')").bind(candidate.url).first();
        if (savedReference) continue;
        const [item] = await youtube(env, ref, budget);
        const profile = readYouTubeProfile(item);
        if (!profile || (ref.id && ref.id !== item.id)) throw new Error('Invalid candidate profile');
        if (known.has(item.id)) {
          await batch([db.prepare(`INSERT INTO directory_candidates(channel_id,name,source_url,reference_url,reason,status,vtuber_id,checked_at)
            VALUES (?,?,?,?,'Already registered','imported',?,?) ON CONFLICT(channel_id) DO NOTHING`)
            .bind(item.id, profile.name, candidate.source, candidate.url, known.get(item.id)[0].id, startedAt)]);
          continue;
        }
        const previous = await db.prepare('SELECT status FROM directory_candidates WHERE channel_id=?').bind(item.id).first();
        if (previous && previous.status !== 'pending') continue;
        const statistics = readYouTubeStatistics(item.statistics);
        const verified = !candidate.graduated && (candidate.agency || isIndependentThaiVTuber(profile));
        const reason = candidate.graduated ? 'Official roster marks this creator graduated'
          : !verified ? 'Thai VTuber / independent affiliation needs primary evidence'
            : !statistics.ok ? statistics.reason : 'Verified primary source';
        const url = canonicalUrl(item.id);
        await batch([db.prepare(`INSERT INTO directory_candidates(channel_id,name,source_url,reference_url,reason,status,checked_at)
          VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(channel_id) DO UPDATE SET name=excluded.name,source_url=excluded.source_url,reference_url=excluded.reference_url,reason=excluded.reason,checked_at=excluded.checked_at
          WHERE directory_candidates.status='pending'`).bind(item.id, profile.name, candidate.source, candidate.url, reason, startedAt)]);
        if (!verified || !statistics.ok) { result.candidatesPending++; continue; }
        if (candidate.agency) await batch([db.prepare('INSERT OR IGNORE INTO agencies(name,contact) VALUES (?,?)').bind(agencyName, 'https://www.pixela.me/')]);
        const saved = await batch([
          db.prepare(`INSERT INTO vtubers(name,slug,bio,avatar,channel_url,youtube_url,platform,country,affiliation,agency_id,agency_name)
            SELECT ?,?,?,?,?,?,'youtube','Thailand',?,${candidate.agency ? '(SELECT id FROM agencies WHERE name=?)' : 'NULL'},?
            WHERE NOT EXISTS (${lookup}) AND EXISTS (SELECT 1 FROM directory_candidates WHERE channel_id=? AND status='pending')`)
            .bind(profile.name, `youtube-${Array.from(new TextEncoder().encode(item.id), byte => byte.toString(16).padStart(2, '0')).join('')}`, profile.bio, profile.avatar, url, url,
              candidate.agency ? 'agency' : 'indie', ...(candidate.agency ? [agencyName] : []), candidate.agency ? agencyName : '', url, url, item.id),
          db.prepare(`UPDATE directory_candidates SET status='imported',vtuber_id=(${lookup}) WHERE channel_id=? AND status='pending' AND EXISTS (${lookup})`)
            .bind(url, url, item.id, url, url),
        ]);
        const inserted = saved[1].meta.changes;
        result.channelsAdded += inserted;
        const row = await db.prepare(lookup).bind(url, url).first();
        if (row) {
          known.set(item.id, [row]);
          const current = await db.prepare('SELECT id,youtube_url,channel_url FROM vtubers WHERE id=?').bind(row.id).first();
          if (current) await batch(profileStatements(db, current, item.id, profile, startedAt));
        }
      } catch { errors.push('Candidate channel could not be verified or saved'); }
    }
    const status = errors.length ? 'partial' : 'succeeded';
    await batch([db.prepare(`UPDATE directory_sync_runs SET status=?,completed_at=?,profiles_checked=?,channels_added=?,candidates_pending=?,error_summary=? WHERE id=?`)
      .bind(status, new Date().toISOString(), result.profilesChecked, result.channelsAdded, result.candidatesPending, [...new Set(errors)].join('; ').slice(0, 2000), run)]);
    return { ok: !errors.length, status, ...result };
  } catch {
    if (run) await batch([db.prepare("UPDATE directory_sync_runs SET status='failed',completed_at=?,error_summary='Directory sync failed; check configuration and retry' WHERE id=?").bind(new Date().toISOString(), run)]);
    return { ok: false, status: 'failed', ...result };
  } finally {
    await db.prepare('UPDATE directory_sync_lease SET owner=NULL,expires_at=0 WHERE id=1 AND owner=? AND fence=?').bind(owner, lease.fence).run();
  }
}
