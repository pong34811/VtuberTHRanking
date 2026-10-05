import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backendDatabase, mountedRequest, seedUser, staffToken } from '../helpers/backend-sqlite.js';
import { INTRO_HOMEPAGE_TEMPLATE_IDS, DEFAULT_INTRO_HOMEPAGE_TEMPLATE } from '../../../shared/intro-homepage-templates.js';
let store;
beforeEach(() => { store = backendDatabase(); seedUser(store); seedUser(store, { id: 'staff', role: 'staff', token: staffToken }); });
afterEach(() => store.close());
const path = '/admin/settings/intro-homepage-template';
const save = template => mountedRequest(store, path, { method: 'PUT', authenticated: true, payload: { intro_homepage_template: template } });
describe('intro homepage settings through mounted API with SQLite', () => {
  it('defaults invalid/missing values, isolates discovery, persists all five and audits writes', async () => {
    expect((await mountedRequest(store, '/intro-homepage-config/')).body).toEqual({ template: DEFAULT_INTRO_HOMEPAGE_TEMPLATE });
    store.sql.prepare('INSERT INTO settings(setting_key,setting_value) VALUES (?,?)').run('intro_homepage_template', 'invalid');
    expect((await mountedRequest(store, path, { authenticated: true })).body).toEqual({ intro_homepage_template: DEFAULT_INTRO_HOMEPAGE_TEMPLATE });
    const discovery = (await mountedRequest(store, '/homepage-config/')).body;
    for (const template of INTRO_HOMEPAGE_TEMPLATE_IDS) {
      expect((await save(template)).status).toBe(200);
      const read = await mountedRequest(store, '/intro-homepage-config/');
      expect(read.body).toEqual({ template });
      expect(read.headers.get('cache-control')).toBe('no-store');
      expect((await mountedRequest(store, path, { authenticated: true })).body).toEqual({ intro_homepage_template: template });
    }
    expect((await mountedRequest(store, '/homepage-config/')).body).toEqual(discovery);
    expect(store.sql.prepare("SELECT count(*) AS n FROM audit_logs WHERE target_id='intro_homepage_template'").get().n).toBe(5);
  });
  it('rejects unauthenticated, staff, invalid IDs, invalid CSRF and foreign origins', async () => {
    expect((await mountedRequest(store, path)).status).toBe(401);
    expect((await mountedRequest(store, path, { authenticated: true, token: staffToken })).status).toBe(403);
    expect((await mountedRequest(store, path, { method: 'PUT', authenticated: true, token: staffToken, payload: { intro_homepage_template: 'paper-atelier-3d' } })).status).toBe(403);
    expect((await save('search-first')).status).toBe(400);
    expect((await mountedRequest(store, path, { method: 'PUT', authenticated: true, payload: { intro_homepage_template: 'paper-atelier-3d' }, headers: { 'X-CSRF-Token': 'wrong' } })).status).toBe(403);
    expect((await mountedRequest(store, path, { method: 'PUT', authenticated: true, origin: 'https://foreign.invalid', payload: { intro_homepage_template: 'paper-atelier-3d' } })).status).toBe(403);
    expect(store.sql.prepare('SELECT count(*) AS n FROM audit_logs').get().n).toBe(0);
  });
  it('rolls back settings if audit fails', async () => {
    await save('sculpture-index-3d');
    store.control.fail = sql => sql.includes('INSERT INTO audit_logs');
    expect((await save('paper-atelier-3d')).status).toBe(500);
    store.control.fail = null;
    expect((await mountedRequest(store, '/intro-homepage-config/')).body.template).toBe('sculpture-index-3d');
    expect(store.sql.prepare('SELECT count(*) AS n FROM audit_logs').get().n).toBe(1);
  });
});
