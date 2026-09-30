import { describe, expect, it } from 'vitest';
import { latestSnapshotOrder, rankingEligibility } from '../../../../shared/snapshot-policy.js';

describe('shared snapshot SQL policy', () => {
  it('orders chronologically with an ID tie-break', () => {
    expect(latestSnapshotOrder()).toBe('julianday(s.recorded_at) DESC, s.id DESC');
    expect(latestSnapshotOrder('ss')).toBe('julianday(ss.recorded_at) DESC, ss.id DESC');
  });
  it('keeps only active YouTube channels including legacy null platforms', () => {
    expect(rankingEligibility()).toBe("v.is_active = 1 AND COALESCE(v.platform, 'youtube') = 'youtube'");
  });
  it.each(['v; DELETE FROM vtubers', 'v.x', '', '9v'])('rejects unsafe alias %j', alias => {
    expect(() => latestSnapshotOrder(alias)).toThrow('Invalid SQL alias');
    expect(() => rankingEligibility(alias)).toThrow('Invalid SQL alias');
  });
});
