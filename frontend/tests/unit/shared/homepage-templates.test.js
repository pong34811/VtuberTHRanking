import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HOMEPAGE_TEMPLATE,
  HOMEPAGE_TEMPLATE_IDS,
  normalizeHomepageTemplate,
} from '../../../../shared/homepage-templates.js';

describe('homepage template contract', () => {
  it('registers the agreed preset IDs and default', () => {
    expect(HOMEPAGE_TEMPLATE_IDS).toEqual(['search-first', 'category-first', 'newest-first']);
    expect(DEFAULT_HOMEPAGE_TEMPLATE).toBe('search-first');
  });

  it.each(['search-first', 'category-first', 'newest-first'])('keeps the registered ID %s', id => {
    expect(normalizeHomepageTemplate(id)).toBe(id);
  });

  it.each([undefined, null, 'custom-layout', 'ranking-first', 'discovery-first', 'compact-ranking'])('falls back to search-first for %s', value => {
    expect(normalizeHomepageTemplate(value)).toBe('search-first');
  });
});
