import { competitionRanks, nextMonthBoundary, previousMonth } from '../../shared/ranking.js';
import { latestSnapshotOrder, rankingEligibility } from '../../shared/snapshot-policy.js';

const statement = (db, sql, ...values) => db.prepare(sql).bind(...values);

// Calculate inside the publication transaction: old materialized ranks are still
// intact here, so a rollback/retry cannot reset the alltime movement baseline.
export function rankingGenerationStatement(db, publicationId, filter, { runId, asOf }) {
  const key = { followers: 'followers', views: 'total_views', videos: 'video_count' }[filter.category];
  if (!key) throw new Error('Unsupported ranking metric');
  const cutoff = filter.period === 'monthly' ? nextMonthBoundary(filter.month) : null;
  const previous = filter.period === 'monthly' ? previousMonth(filter.month) : null;
  return statement(db, `INSERT INTO ranking_publication_rows
    (publication_id,vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at)
    WITH latest AS (
      SELECT v.id AS vtuber_id,s.followers,s.total_views,s.video_count
      FROM vtubers v JOIN stats_snapshots s ON s.id=(
        SELECT ss.id FROM stats_snapshots ss WHERE ss.vtuber_id=v.id
          AND julianday(ss.recorded_at)<=julianday(?)
          AND (? IS NULL OR julianday(ss.recorded_at)<julianday(?))
        ORDER BY ${latestSnapshotOrder('ss')} LIMIT 1)
      WHERE ${rankingEligibility()} AND v.id IN (SELECT vtuber_id FROM ranking_pipeline_snapshots WHERE run_id=?)
    ), ranked AS (SELECT *,RANK() OVER (ORDER BY ${key} DESC) AS position FROM latest)
    SELECT ?,r.vtuber_id,?,?,?,r.position,r.${key},COALESCE(archived.rank,old.rank)-r.position,
      r.followers,r.total_views,r.video_count,'active',?
    FROM ranked r LEFT JOIN rankings old ON old.vtuber_id=r.vtuber_id AND old.period=? AND old.category=? AND old.month IS ?
    LEFT JOIN ranking_publication_rows archived ON archived.publication_id=? AND archived.vtuber_id=r.vtuber_id
      AND archived.period='monthly' AND ?='monthly' AND archived.category=? AND archived.month IS ?
    ORDER BY r.position,r.vtuber_id`, asOf, cutoff, cutoff, runId, publicationId,
  filter.period, filter.category, filter.month, asOf, filter.period, filter.category, previous,
  publicationId, filter.period, filter.category, previous);
}

export async function calculateRanking(db, filter, extraStatements = []) {
  const cutoff = filter.period === 'monthly' ? nextMonthBoundary(filter.month) : null;
  const rows = (await statement(db, `
    SELECT v.id AS vtuber_id,s.followers,s.total_views,s.video_count
    FROM vtubers v
    JOIN stats_snapshots s ON s.id=(
      SELECT ss.id FROM stats_snapshots ss
      WHERE ss.vtuber_id=v.id AND (? IS NULL OR julianday(ss.recorded_at)<julianday(?))
      ORDER BY ${latestSnapshotOrder('ss')} LIMIT 1
    )
    WHERE ${rankingEligibility()}
  `, cutoff, cutoff).all()).results || [];

  const previousFilter = {
    ...filter,
    month: filter.period === 'monthly' ? previousMonth(filter.month) : null,
  };
  const previous = (await statement(db,
    'SELECT vtuber_id,rank FROM rankings WHERE period=? AND category=? AND month IS ? ORDER BY rank,vtuber_id',
    previousFilter.period, filter.category, previousFilter.month,
  ).all()).results || [];
  const ranked = competitionRanks(rows, filter.category, previous);
  const inserts = [];
  for (let index = 0; index < ranked.length; index += 100) {
    inserts.push(statement(db, `INSERT INTO rankings
      (vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at)
      SELECT json_extract(value,'$.vtuber_id'),?,?,?,json_extract(value,'$.rank'),json_extract(value,'$.score'),
        json_extract(value,'$.rank_change'),json_extract(value,'$.followers'),json_extract(value,'$.total_views'),
        json_extract(value,'$.video_count'),'active',datetime('now') FROM json_each(?)`,
    filter.period, filter.category, filter.month, JSON.stringify(ranked.slice(index, index + 100))));
  }

  await db.batch([
    statement(db, 'DELETE FROM rankings WHERE period=? AND category=? AND month IS ?', filter.period, filter.category, filter.month),
    ...inserts,
    ...(typeof extraStatements === 'function' ? extraStatements(ranked.length) : extraStatements),
  ]);
  return { count: ranked.length };
}
