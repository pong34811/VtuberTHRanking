import { currentMonth } from './ranking-period.js';

export const SITE_SETTING_KEYS = ['site_name', 'site_status', 'current_ranking_period', 'ranking_update_frequency'];
export const RANKING_CATEGORIES = ['followers', 'views', 'videos'];
export const validRankingMonth = value => typeof value === 'string' && /^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/.test(value);
const validLabel = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 100 && !/[\u0000-\u001f\u007f-\u009f]/.test(value);

export async function readSiteConfig(db) {
  const defaults = { site_name: 'VTuberThai Ranking', site_status: 'active', current_ranking_period: currentMonth(), ranking_update_frequency: 'manual' };
  if (!db) return defaults;
  const { results } = await db.prepare(`SELECT setting_key,setting_value FROM settings WHERE setting_key IN (${SITE_SETTING_KEYS.map(() => '?').join(',')})`).bind(...SITE_SETTING_KEYS).all();
  const values = Object.fromEntries(results.map(row => [row.setting_key, row.setting_value]));
  return {
    site_name: validLabel(values.site_name) ? values.site_name.trim() : defaults.site_name,
    site_status: ['active', 'maintenance'].includes(values.site_status) ? values.site_status : defaults.site_status,
    current_ranking_period: validRankingMonth(values.current_ranking_period) ? values.current_ranking_period : defaults.current_ranking_period,
    ranking_update_frequency: ['manual', 'hourly', 'daily', 'weekly', 'monthly'].includes(values.ranking_update_frequency) ? values.ranking_update_frequency : defaults.ranking_update_frequency,
  };
}

export async function readCategoryChoices(db) {
  if (!db) return [];
  const { results } = await db.prepare("SELECT id,name,sort_order,status FROM categories WHERE id IN ('followers','views','videos') AND status='active' ORDER BY sort_order,id").all();
  return results.filter(row => RANKING_CATEGORIES.includes(row.id) && row.status === 'active' && validLabel(row.name) && Number.isInteger(row.sort_order) && row.sort_order >= 0 && row.sort_order <= 1000)
    .map(row => ({ value: row.id, label: row.name.trim(), sort_order: row.sort_order, status: row.status }));
}

export async function requestSiteConfig(c) {
  const config = c.get('siteConfig') || await readSiteConfig(c.env.DB);
  c.set('siteConfig', config);
  return config;
}

export async function selectedRankingMonth(c) {
  const explicit = c.req.query('month');
  return validRankingMonth(explicit) ? explicit : (await requestSiteConfig(c)).current_ranking_period;
}
