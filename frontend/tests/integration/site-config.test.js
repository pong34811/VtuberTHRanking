import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendDatabase, mountedRequest, seedUser } from '../helpers/backend-sqlite.js';

const stores = [];
const database = () => { const store = backendDatabase(); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); vi.restoreAllMocks(); vi.useRealTimers(); });

const settings = { site_name: 'Configured Ranking', site_status: 'maintenance', current_ranking_period: '2026-08', ranking_update_frequency: 'daily' };

describe('operational public configuration', () => {
  it('publishes only sanitized public settings and active supported metric choices', async () => {
    const store = database();
    for (const [key, value] of Object.entries(settings)) store.sql.prepare('UPDATE settings SET setting_value=? WHERE setting_key=?').run(value, key);
    store.sql.prepare('INSERT INTO settings(setting_key,setting_value) VALUES (?,?)').run('private-api-key', 'not-public');
    store.sql.exec("UPDATE categories SET name='Uploads',sort_order=0 WHERE id='videos'; UPDATE categories SET status='inactive' WHERE id='views'");
    const result = await mountedRequest(store, '/site-config/');
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.body).toEqual({ ...settings, category_choices: [
      { value: 'videos', label: 'Uploads', sort_order: 0, status: 'active' },
      { value: 'followers', label: 'ผู้ติดตาม', sort_order: 1, status: 'active' },
    ] });
    expect(JSON.stringify(result.body)).not.toContain('not-public');
  });

  it('enforces maintenance on every public feature but leaves config, root, auth and Admin available', async () => {
    const store = database();
    seedUser(store);
    const write = await mountedRequest(store, '/admin/settings', { method: 'PUT', authenticated: true, payload: settings });
    expect(write.status).toBe(200);
    expect(store.sql.prepare("SELECT setting_value FROM settings WHERE setting_key='site_status'").get().setting_value).toBe('maintenance');
    for (const path of ['/summary/', '/rankings/', '/directory/', '/vtubers/', '/vtubers/unknown/', '/vtubers/unknown/history/', '/homepage-config/', '/compare/']) {
      const result = await mountedRequest(store, path, path === '/compare/' ? { method: 'POST', payload: { vtubers: [1, 2] } } : {});
      expect(result.status, path).toBe(503);
      expect(result.headers.get('Retry-After')).toBe('300');
      expect(result.body.site_status).toBe('maintenance');
      expect(result.headers.get('Cache-Control')).toBe('no-store');
    }
    for (const path of ['/', '', '/site-config/']) expect((await mountedRequest(store, path)).status, path).toBe(200);
    expect((await mountedRequest(store, '/auth/me', { authenticated: true })).status).toBe(200);
    expect((await mountedRequest(store, '/admin/settings', { authenticated: true })).status).toBe(200);
  });

  it('uses safe defaults for malformed stored settings without leaking other fields', async () => {
    const store = database();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T17:00:00Z'));
    store.sql.exec("UPDATE settings SET setting_value='invalid'; UPDATE settings SET setting_value=char(0) WHERE setting_key='site_name'");
    const result = await mountedRequest(store, '/site-config/');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ site_name: 'VTuberThai Ranking', site_status: 'active', current_ranking_period: '2026-10', ranking_update_frequency: 'manual' });
  });
});

describe('stable operational ranking categories', () => {
  const category = { name: 'Views', slug: 'views', description: 'Views metric', sort_order: 2, status: 'active' };
  it.each([
    ['views', { ...category, slug: 'new-metric' }, 'slug'],
    ['views', { ...category, id: 'videos' }, 'ID'],
    ['likes', category, 'category'],
    ['views', { ...category, metric: 'followers' }, 'field'],
  ])('rejects immutable or unsupported category changes for %s', async (id, payload, message) => {
    const store = database(); seedUser(store);
    const result = await mountedRequest(store, `/admin/categories/${id}`, { method: 'PUT', authenticated: true, payload });
    expect(result.status).toBe(400);
    expect(result.body.message).toContain(message);
    expect(store.sql.prepare("SELECT slug FROM categories WHERE id='views'").get().slug).toBe('views');
  });

  it('uses active configured categories consistently in choices, ranking requests and profile ranks', async () => {
    const store = database(); seedUser(store);
    store.sql.exec("INSERT INTO vtubers(id,name,slug,channel_url) VALUES (1,'Alpha','alpha','https://youtube.com/@alpha'); INSERT INTO rankings(vtuber_id,period,category,month,rank,score) VALUES (1,'alltime','views',NULL,1,100)");
    expect((await mountedRequest(store, '/admin/categories/views', { method: 'PUT', authenticated: true, payload: { ...category, status: 'inactive' } })).status).toBe(200);
    expect((await mountedRequest(store, '/site-config/')).body.category_choices.some(row => row.value === 'views')).toBe(false);
    expect((await mountedRequest(store, '/rankings/?period=alltime&category=views')).status).toBe(400);
    const profile = await mountedRequest(store, '/vtubers/alpha/');
    expect(profile.body.current_rank).not.toHaveProperty('alltime_views');
    expect(profile.body.category_choices.some(row => row.value === 'views')).toBe(false);
  });

  it('defaults Admin monthly ranking selection to the configured month, with explicit override', async () => {
    const store = database(); seedUser(store);
    store.sql.exec("UPDATE settings SET setting_value='2026-08' WHERE setting_key='current_ranking_period'; INSERT INTO vtubers(id,name,slug,channel_url) VALUES (1,'Alpha','alpha','https://youtube.com/@alpha'); INSERT INTO rankings(vtuber_id,period,category,month,rank,score) VALUES (1,'monthly','followers','2026-08-01',1,100)");
    const result = await mountedRequest(store, '/admin/rankings', { authenticated: true });
    expect(result.status).toBe(200);
    expect(result.body.results).toHaveLength(1);
    expect(result.body.results[0].month).toBe('2026-08-01');
    expect((await mountedRequest(store, '/admin/rankings?month=2026-07', { authenticated: true })).body.results).toEqual([]);
  });
});
