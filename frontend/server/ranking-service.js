import { competitionRanks, nextMonthBoundary, previousMonth } from '../../shared/ranking.js';

const statement = (db, sql, ...values) => db.prepare(sql).bind(...values);

export async function calculateRanking(db, filter, extraStatements = []) {
  const cutoff = filter.period === 'monthly' ? nextMonthBoundary(filter.month) : null;
  const rows = (await statement(db, `
    SELECT v.id AS vtuber_id,s.followers,s.total_views,s.video_count
    FROM vtubers v
    JOIN stats_snapshots s ON s.id=(
      SELECT ss.id FROM stats_snapshots ss
      WHERE ss.vtuber_id=v.id AND (? IS NULL OR julianday(ss.recorded_at)<julianday(?))
      ORDER BY julianday(ss.recorded_at) DESC,ss.id DESC LIMIT 1
    )
    WHERE v.is_active=1 LIMIT 91
  `, cutoff, cutoff).all()).results || [];

  if (rows.length > 90) {
    const error = new Error('Ranking publication supports at most 90 channels per batch; no changes were saved');
    error.code = 'RANKING_CHANNEL_LIMIT';
    throw error;
  }

  const previousFilter = {
    ...filter,
    month: filter.period === 'monthly' ? previousMonth(filter.month) : null,
  };
  const previous = (await statement(db,
    'SELECT vtuber_id,rank FROM rankings WHERE period=? AND category=? AND month IS ? ORDER BY rank,vtuber_id',
    previousFilter.period, filter.category, previousFilter.month,
  ).all()).results || [];
  const ranked = competitionRanks(rows, filter.category, previous);

  await db.batch([
    statement(db, 'DELETE FROM rankings WHERE period=? AND category=? AND month IS ?', filter.period, filter.category, filter.month),
    ...ranked.map(row => statement(db, "INSERT INTO rankings (vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'active',datetime('now'))", row.vtuber_id, filter.period, filter.category, filter.month, row.rank, row.score, row.rank_change, row.followers, row.total_views, row.video_count)),
    ...(typeof extraStatements === 'function' ? extraStatements(ranked.length) : extraStatements),
  ]);
  return { count: ranked.length };
}
