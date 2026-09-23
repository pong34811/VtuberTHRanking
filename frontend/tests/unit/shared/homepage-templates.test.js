import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOMEPAGE_TEMPLATE,
  HOMEPAGE_TEMPLATE_IDS,
  normalizeHomepageTemplate,
} from '../../../../shared/homepage-templates.js';

describe('homepage template contract', () => {
  it('registers the agreed preset IDs and default', () => {
    expect(HOMEPAGE_TEMPLATE_IDS).toEqual(['ranking-first', 'discovery-first', 'compact-ranking']);
    expect(DEFAULT_HOMEPAGE_TEMPLATE).toBe('ranking-first');
  });

  it.each(['ranking-first', 'discovery-first', 'compact-ranking'])('keeps the registered ID %s', id => {
    expect(normalizeHomepageTemplate(id)).toBe(id);
  });

  it.each([undefined, null, 'custom-layout'])('falls back to ranking-first for %s', value => {
    expect(normalizeHomepageTemplate(value)).toBe('ranking-first');
  });
});
