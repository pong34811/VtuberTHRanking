import { describe, expect, it } from 'vitest';
import { affiliationLabel, categoryLabel } from '../../../src/components/channelLabels.js';

describe('channel labels', () => {
  it.each([
    ['gaming', 'เกม'],
    ['singing', 'ร้องเพลง'],
    ['chatting', 'พูดคุย'],
    ['art', 'วาดรูป'],
    ['asmr', 'ASMR'],
    ['education', 'ความรู้'],
    ['other', 'อื่นๆ'],
  ])('labels the %s category in Thai', (value, label) => {
    expect(categoryLabel(value)).toBe(label);
  });

  it('uses a readable fallback for an unknown category', () => {
    expect(categoryLabel('unknown')).toBe('อื่นๆ');
  });

  it('labels affiliations and falls back for missing data', () => {
    expect(affiliationLabel('indie')).toBe('อิสระ');
    expect(affiliationLabel('agency')).toBe('สังกัด');
    expect(affiliationLabel(null)).toBe('ไม่ระบุสังกัด');
  });
});
