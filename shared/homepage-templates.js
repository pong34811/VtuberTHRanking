export const HOMEPAGE_TEMPLATE_IDS = Object.freeze([
  'ranking-first',
  'discovery-first',
  'compact-ranking',
]);

export const DEFAULT_HOMEPAGE_TEMPLATE = 'ranking-first';

export const normalizeHomepageTemplate = value =>
  HOMEPAGE_TEMPLATE_IDS.includes(value) ? value : DEFAULT_HOMEPAGE_TEMPLATE;
