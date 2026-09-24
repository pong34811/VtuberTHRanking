export const HOMEPAGE_TEMPLATE_IDS = Object.freeze([
  'search-first',
  'category-first',
  'newest-first',
]);

export const DEFAULT_HOMEPAGE_TEMPLATE = 'search-first';

export const normalizeHomepageTemplate = value =>
  HOMEPAGE_TEMPLATE_IDS.includes(value) ? value : DEFAULT_HOMEPAGE_TEMPLATE;
