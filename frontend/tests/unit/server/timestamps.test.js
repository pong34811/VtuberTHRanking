import { expect, it } from 'vitest';
import { timestampDate } from '../../../../shared/timestamps.js';

it('interprets SQLite legacy times and ISO timestamps as the same UTC instant', () => {
  expect(timestampDate('2026-09-01 12:00:00').toISOString()).toBe('2026-09-01T12:00:00.000Z');
  expect(timestampDate('2026-09-01T12:00:00.000Z').toISOString()).toBe('2026-09-01T12:00:00.000Z');
  expect(timestampDate('2026-09-01T19:00:00+07:00').toISOString()).toBe('2026-09-01T12:00:00.000Z');
  expect(timestampDate(null)).toBeNull();
  expect(timestampDate('invalid')).toBeNull();
});
