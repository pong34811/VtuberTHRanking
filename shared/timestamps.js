// SQLite legacy CURRENT_TIMESTAMP values have no zone but represent UTC.
export function timestampDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let timestamp = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) timestamp += 'T00:00:00';
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) timestamp += 'Z';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}
