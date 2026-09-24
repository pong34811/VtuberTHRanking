import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import admin from '../../server/admin.js';
import publicApi from '../../server/public.js';
import { createD1Stub } from '../helpers/d1.js';

const manager = { id: 'manager-1', role: 'manager', status: 'active' };
const staff = { id: 'staff-1', role: 'staff', status: 'active' };
const jsonPut = body => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function requestAdmin(path, { user = manager, responses = [], init = {} } = {}) {
  const { calls, db } = createD1Stub(responses);
  const app = new Hono();
  app.use('*', async (c, next) => { c.set('user', user); await next(); });
  app.route('/', admin);
  const response = await app.fetch(new Request(`https://example.com${path}`, init), { DB: db });
  return { response, calls };
}

async function requestPublic(path, responses = []) {
  const { calls, db } = createD1Stub(responses);
  const response = await publicApi.fetch(new Request(`https://example.com${path}`), { DB: db });
  return { calls, response };
}

describe('Admin homepage template settings', () => {
  it('manager GET defaults to search-first when no setting exists', async () => {
    const { response, calls } = await requestAdmin('/settings/homepage-template');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ homepage_template: 'search-first' });
    expect(calls[0]).toMatchObject({
      sql: 'SELECT setting_value FROM settings WHERE setting_key=?',
      values: ['homepage_template'],
      operation: 'first',
    });
  });

  it('manager GET returns the saved template', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      responses: [{ setting_value: 'category-first' }],
    });

    await expect(response.json()).resolves.toEqual({ homepage_template: 'category-first' });
  });

  it('manager GET normalizes an invalid stored template', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      responses: [{ setting_value: 'custom-layout' }],
    });

    await expect(response.json()).resolves.toEqual({ homepage_template: 'search-first' });
  });

  it.each(['ranking-first', 'discovery-first', 'compact-ranking'])('normalizes legacy stored ID %s to search-first', async template => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      responses: [{ setting_value: template }],
    });
    await expect(response.json()).resolves.toEqual({ homepage_template: 'search-first' });
  });

  it('staff GET is forbidden', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', { user: staff });

    expect(response.status).toBe(403);
  });

  it('staff PUT is forbidden', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      user: staff,
      init: jsonPut({ homepage_template: 'search-first' }),
    });

    expect(response.status).toBe(403);
  });

  it('manager PUT rejects an unknown template without database calls', async () => {
    const { response, calls } = await requestAdmin('/settings/homepage-template', {
      init: jsonPut({ homepage_template: 'custom-layout' }),
    });

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each(['ranking-first', 'discovery-first', 'compact-ranking'])('rejects old publication ID %s', async homepage_template => {
    const { response, calls } = await requestAdmin('/settings/homepage-template', { init: jsonPut({ homepage_template }) });
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('manager PUT persists and audits the selected template in one batch', async () => {
    const { response, calls } = await requestAdmin('/settings/homepage-template', {
      init: jsonPut({ homepage_template: 'newest-first' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, homepage_template: 'newest-first' });
    expect(calls).toHaveLength(2);
    expect(calls.map(call => call.operation)).toEqual(['run', 'run']);
    expect(calls[0]).toMatchObject({
      sql: expect.stringContaining('INSERT INTO settings'),
      values: ['homepage_template', 'newest-first'],
    });
    expect(calls[1]).toMatchObject({
      sql: expect.stringContaining('INSERT INTO audit_logs'),
      values: expect.arrayContaining(['manager-1', 'update', 'settings', 'homepage_template']),
    });
  });
});

describe('public homepage configuration', () => {
  it.each(['ranking-first', 'discovery-first', 'compact-ranking', 'unknown', null])('normalizes stored %s on public read', async value => {
    const { response } = await requestPublic('/homepage-config/', [value == null ? null : { setting_value: value }]);
    expect(await response.json()).toEqual({ template: 'search-first' });
  });

  it.each(['search-first', 'category-first', 'newest-first'])('publishes %s through configuration', async template => {
    const { response } = await requestPublic('/homepage-config/', [{ setting_value: template }]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ template });
  });

  it('reports DB unavailable without a database', async () => {
    const response = await publicApi.fetch(new Request('https://example.com/homepage-config/'), {});
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'DB not available' });
  });
});
