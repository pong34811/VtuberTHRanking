// Ranking periods follow Bangkok time (UTC+7), including the first hours of a month.
export function nextMonthBoundary(value) {
  const [year, mon] = value.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 1) - 7 * 3600000).toISOString();
}

export function previousMonth(value) {
  const [year, mon] = value.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 10);
}

export function competitionRanks(rows, category, previous = []) {
  const key = category === 'followers' ? 'followers' : category === 'videos' ? 'video_count' : 'total_views';
  const old = new Map(previous.map(row => [row.vtuber_id, row.rank]));
  const sorted = [...rows].sort((a, b) => b[key] - a[key] || a.vtuber_id - b.vtuber_id);
  let rank = 0;
  return sorted.map((row, index) => {
    if (!index || row[key] !== sorted[index - 1][key]) rank = index + 1;
    return { ...row, score: row[key], rank, rank_change: old.has(row.vtuber_id) ? old.get(row.vtuber_id) - rank : null };
  });
}
