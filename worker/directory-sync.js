import { readYouTubeStatistics } from '../shared/youtube-statistics.js';
import { candidateUpsert, canonicalYouTubeUrl, youtubeChannelAlias as channelAlias } from '../shared/directory-candidates.js';
import { youtubeReference, readYouTubeProfile, youtubeChannelLookup as lookup } from '../shared/youtube-profile.js';

export const DIRECTORY_SEARCHES = ['Thai VTuber', 'VTuber ไทย', 'วีทูบเบอร์ไทย', 'วีทูปเบอร์ไทย', 'Thai VTuber debut', 'VTuber ไทย debut', 'วีทูบเบอร์ไทย เดบิว', 'วีทูปเบอร์ไทย เดบิว'].flatMap(q => ['channel','video'].map(type => ({ q, type })));
const canonicalUrl = canonicalYouTubeUrl;

async function youtube(env, query, budget, search = false) {
  if (budget.requests >= 40 || Date.now() >= budget.deadline) throw new Error('Directory request budget exhausted');
  budget.requests++;
  const url = new URL(`https://www.googleapis.com/youtube/v3/${search ? 'search' : 'channels'}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set('part', search ? 'snippet' : 'snippet,statistics');
  url.searchParams.set('key', env.YOUTUBE_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(8000, Math.max(1, budget.deadline - Date.now()))), headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } });
  if (!response.ok) throw new Error('YouTube directory request failed');
  const body = await response.json();
  if (!Array.isArray(body?.items) || body.items.length > (search ? 10 : 50)) throw new Error('Invalid YouTube directory response');
  if (search && body.nextPageToken !== undefined && (typeof body.nextPageToken !== 'string' || body.nextPageToken.length > 2048)) throw new Error('Invalid YouTube pagination');
  return search ? body : body.items;
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
  const result = { profilesChecked: 0, channelsAdded: 0, candidatesPending: 0, candidatesChecked: 0, candidatesNew: 0, candidatesDuplicate: 0, candidatesUnavailable: 0 };
  const errors = [];
  try {
    let checkpoint = await db.prepare('SELECT * FROM directory_search_checkpoint WHERE id=1').first();
    const sweepDay = checkpoint && !checkpoint.completed ? checkpoint.day : day;
    const existingRun = await db.prepare('SELECT * FROM directory_sync_runs WHERE day=?').bind(sweepDay).first();
    if (existingRun?.status === 'succeeded') return { ok: true, skipped: 'not due' };
    run = existingRun?.id || owner;
    await batch([
      db.prepare("UPDATE directory_sync_runs SET status='failed',completed_at=?,error_summary='Directory lease expired' WHERE status='running'").bind(startedAt),
      db.prepare(`INSERT INTO directory_sync_runs(id,day,status,started_at) VALUES (?,?,'running',?)
        ON CONFLICT(day) DO UPDATE SET status='running',started_at=excluded.started_at,completed_at=NULL`).bind(run, sweepDay, startedAt),
    ]);
    if (!env.YOUTUBE_API_KEY) throw new Error('YouTube API key is not configured');
    if (!checkpoint || (checkpoint.completed && checkpoint.day !== day)) {
      await batch([db.prepare(`INSERT INTO directory_search_checkpoint(id,day) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET day=excluded.day,query_index=0,page_token='',items_json='[]',next_page_token='',completed=0`).bind(day)]);
      checkpoint = { day, query_index: 0, page_token: '', items_json: '[]', next_page_token: '', completed: 0 };
    }
    const budget = { requests: 0, deadline: Date.now() + 60_000 };
    const cursor = (await db.prepare('SELECT last_vtuber_id FROM directory_profile_cursor WHERE id=1').first()).last_vtuber_id;
    const channelQuery = `SELECT v.id,v.youtube_url,v.channel_url,v.is_active,s.channel_id,s.reference_json FROM vtubers v
      LEFT JOIN youtube_profile_state s ON s.vtuber_id=v.id WHERE (v.platform='youtube' OR v.platform IS NULL)`;
    const [afterCursor, beforeCursor] = await Promise.all([
      db.prepare(`${channelQuery} AND v.id>? ORDER BY v.id`).bind(cursor).all(),
      db.prepare(`${channelQuery} AND v.id<=? ORDER BY v.id`).bind(cursor).all(),
    ]);
    const channels = [...afterCursor.results, ...beforeCursor.results];
    const known = new Map();
    let handlesResolved = 0;
    let position = 0;
    while (position < channels.length && budget.requests < 20 && Date.now() < budget.deadline) {
      const requested = new Map();
      let lastId;
      while (position < channels.length && requested.size < 50) {
        const row = channels[position];
        const ref = youtubeReference(row.youtube_url) || youtubeReference(row.channel_url);
        if (row.channel_id && ref?.forHandle && row.reference_json === JSON.stringify({ youtube_url: row.youtube_url || '', channel_url: row.channel_url || '' })) ref.id = row.channel_id;
        if (ref?.forHandle && !ref.id) {
          if (handlesResolved >= 10 || budget.requests >= 19 || Date.now() >= budget.deadline) break;
          handlesResolved++;
          try {
            const [item] = await youtube(env, ref, budget);
            if (!readYouTubeProfile(item)) throw new Error('Invalid channel profile');
            ref.id = item.id;
          } catch { errors.push(`Channel ${row.id}: handle lookup failed`); }
        }
        if (ref?.id) {
          if (!known.has(ref.id)) known.set(ref.id, []);
          known.get(ref.id).push(row);
          if (!requested.has(ref.id)) requested.set(ref.id, []);
          requested.get(ref.id).push(row);
        } else if (row.is_active && !ref?.forHandle) errors.push(`Channel ${row.id}: no usable YouTube reference`);
        lastId = row.id;
        position++;
      }
      if (lastId === undefined) break;
      if (requested.size) {
        try {
          const items = await youtube(env, { id: [...requested.keys()].join(',') }, budget);
          const byId = new Map(items.map(item => [item.id, item]));
          for (const [id, rows] of requested) {
            const profile = readYouTubeProfile(byId.get(id));
            if (!profile) { errors.push(`Channel ${id}: profile unavailable`); continue; }
            for (const row of rows.filter(row => row.is_active)) {
              await batch(profileStatements(db, row, id, profile, startedAt)); result.profilesChecked++;
            }
          }
        } catch { errors.push('Existing channel profiles could not be refreshed'); }
      }
      // Advance even after an unavailable profile; the next rotation retries it without starving later IDs.
      await batch([db.prepare('UPDATE directory_profile_cursor SET last_vtuber_id=? WHERE id=1').bind(lastId)]);
    }
    if (position < channels.length) errors.push('Existing profile refresh deferred; rotating cursor resumes next invocation');
    const seenCandidates = new Set();
    while (!checkpoint.completed && budget.requests < 40 && Date.now() < budget.deadline) {
      let items = JSON.parse(checkpoint.items_json);
      const search = DIRECTORY_SEARCHES[checkpoint.query_index];
      if (!items.length) {
        try {
          const page = await youtube(env, { ...search, order: 'date', relevanceLanguage: 'th', maxResults: '10', ...(checkpoint.page_token && { pageToken: checkpoint.page_token }) }, budget, true);
          items = page.items;
          checkpoint.items_json = JSON.stringify(items);
          checkpoint.next_page_token = page.nextPageToken || '';
          // Persist the whole page before fetching profiles; a quota/time interruption resumes its unprocessed tail.
          await batch([db.prepare('UPDATE directory_search_checkpoint SET items_json=?,next_page_token=? WHERE id=1').bind(checkpoint.items_json, checkpoint.next_page_token)]);
        } catch { errors.push('YouTube candidate search failed; sweep will resume'); break; }
      }
      let interrupted = false;
      while (items.length) {
        if (budget.requests >= 40 || Date.now() >= budget.deadline) { interrupted = true; break; }
        const hint = items[0];
        const channelId = search.type === 'video' ? hint.snippet?.channelId : hint.id?.channelId;
        const statements = [];
        let candidateWrite = false;
        let countedDuplicate = false;
        try {
          if (/^UC[A-Za-z0-9_-]{22}$/.test(channelId || '')) {
            result.candidatesChecked++;
            const url = canonicalYouTubeUrl(channelId);
            const registered = known.has(channelId) || await db.prepare(lookup).bind(url, url).first();
            const previous = await db.prepare('SELECT status FROM directory_candidates WHERE channel_id=?').bind(channelId).first();
            if (registered || previous) { result.candidatesDuplicate++; countedDuplicate = true; }
            if (!registered && !seenCandidates.has(channelId) && (!previous || previous.status === 'pending')) {
              const [item] = await youtube(env, { id: channelId }, budget);
              const profile = item?.id === channelId ? readYouTubeProfile(item) : null;
              const alias = profile ? channelAlias(item) : url;
              const fetchedExisting = known.has(channelId) || await db.prepare(lookup).bind(url, alias).first();
              if (fetchedExisting) {
                if (!countedDuplicate) result.candidatesDuplicate++;
                known.set(channelId, [fetchedExisting]);
              } else {
                if (!profile) { result.candidatesUnavailable++; errors.push('Candidate channel profile unavailable'); }
                const evidence = [{ kind: 'search-hint', query: search.q, type: search.type,
                  source: search.type === 'video' && /^[A-Za-z0-9_-]{11}$/.test(hint.id?.videoId || '') ? `https://www.youtube.com/watch?v=${hint.id.videoId}` : url },
                  ...(profile ? [{ kind: 'youtube-profile', source: url, description: profile.bio }] : [])];
                candidateWrite = true;
                statements.push(db.prepare('SELECT status FROM directory_candidates WHERE channel_id=?').bind(channelId));
                statements.push(db.prepare(candidateUpsert).bind(channelId, profile?.name || String(hint.snippet?.channelTitle || hint.snippet?.title || channelId).slice(0,100),
                  url, url, profile ? (readYouTubeStatistics(item.statistics).ok ? 'Manager review required; search is only a hint' : readYouTubeStatistics(item.statistics).reason) : 'YouTube channel profile unavailable; manager review required',
                  startedAt, JSON.stringify(profile || {}), JSON.stringify(evidence), '{}', url, alias));
              }

            }
          } else result.candidatesUnavailable++;
          const remaining = items.slice(1);
          statements.push(db.prepare('UPDATE directory_search_checkpoint SET items_json=? WHERE id=1').bind(JSON.stringify(remaining)));
          const saved = await batch(statements);
          if (candidateWrite) {
            seenCandidates.add(channelId);
            if (!saved[1].results.length && saved[2].meta.changes) result.candidatesNew++;
            if (!saved[2].meta.changes && !countedDuplicate) result.candidatesDuplicate++;
          }
          items = remaining;
          checkpoint.items_json = JSON.stringify(items);
        } catch { errors.push('Candidate profile lookup failed; sweep will resume'); interrupted = true; break; }
      }
      if (interrupted) break;
      if (checkpoint.next_page_token) checkpoint.page_token = checkpoint.next_page_token;
      else { checkpoint.query_index++; checkpoint.page_token = ''; }
      checkpoint.next_page_token = '';
      checkpoint.completed = Number(checkpoint.query_index >= DIRECTORY_SEARCHES.length);
      await batch([db.prepare(`UPDATE directory_search_checkpoint SET query_index=?,page_token=?,items_json='[]',next_page_token='',completed=? WHERE id=1`)
        .bind(checkpoint.query_index, checkpoint.page_token, checkpoint.completed)]);
    }
    result.sweep = { day: checkpoint.day, queryIndex: checkpoint.query_index, queryTotal: DIRECTORY_SEARCHES.length,
      remainingItems: JSON.parse(checkpoint.items_json).length, completed: Boolean(checkpoint.completed) };
    if (!checkpoint.completed) errors.push('Search sweep incomplete; resumes next hourly invocation');
    result.candidatesPending = (await db.prepare("SELECT COUNT(*) AS n FROM directory_candidates WHERE status='pending'").first()).n;
    const status = errors.length ? 'partial' : 'succeeded';
    await batch([db.prepare(`UPDATE directory_sync_runs SET status=?,completed_at=?,profiles_checked=?,channels_added=?,candidates_pending=?,candidates_checked=candidates_checked+?,candidates_new=candidates_new+?,candidates_duplicate=candidates_duplicate+?,candidates_unavailable=candidates_unavailable+?,error_summary=? WHERE id=?`)
      .bind(status, new Date().toISOString(), result.profilesChecked, result.channelsAdded, result.candidatesPending, result.candidatesChecked, result.candidatesNew, result.candidatesDuplicate, result.candidatesUnavailable, [...new Set(errors)].join('; ').slice(0, 2000), run)]);
    return { ok: !errors.length, status, ...result };
  } catch {
    if (run) await batch([db.prepare("UPDATE directory_sync_runs SET status='failed',completed_at=?,error_summary='Directory sync failed; check configuration and retry' WHERE id=?").bind(new Date().toISOString(), run)]);
    return { ok: false, status: 'failed', ...result };
  } finally {
    await db.prepare('UPDATE directory_sync_lease SET owner=NULL,expires_at=0 WHERE id=1 AND owner=? AND fence=?').bind(owner, lease.fence).run();
  }
}
