import { HTTPException } from 'hono/http-exception';

export function strictIsoTimestamp(value) {
  const invalid = () => { throw new HTTPException(400, { message: 'recorded_at must be a valid ISO timestamp with timezone' }); };
  if (typeof value !== 'string') invalid();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-](\d{2}):(\d{2}))$/);
  if (!match) invalid();
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second || 0) > 59 || Number(offsetHour || 0) > 23 || Number(offsetMinute || 0) > 59) invalid();
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) invalid();
  return new Date(epoch).toISOString();
}

// SQLite datetime('now') is UTC, although JavaScript parses the space-separated
// spelling as local time. Serialize legacy values with an explicit UTC suffix.
export function publicTimestamp(value) {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)) return value;
  try { return strictIsoTimestamp(value.replace(' ', 'T') + 'Z'); }
  catch { return null; }
}
