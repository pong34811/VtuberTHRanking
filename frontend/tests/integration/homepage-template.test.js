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
  it('manager GET defaults to ranking-first when no setting exists', async () => {
    const { response, calls } = await requestAdmin('/settings/homepage-template');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ homepage_template: 'ranking-first' });
    expect(calls[0]).toMatchObject({
      sql: 'SELECT setting_value FROM settings WHERE setting_key=?',
      values: ['homepage_template'],
      operation: 'first',
    });
  });

  it('manager GET returns the saved template', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      responses: [{ setting_value: 'discovery-first' }],
    });

    await expect(response.json()).resolves.toEqual({ homepage_template: 'discovery-first' });
  });

  it('manager GET normalizes an invalid stored template', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      responses: [{ setting_value: 'custom-layout' }],
    });

    await expect(response.json()).resolves.toEqual({ homepage_template: 'ranking-first' });
  });

  it('staff GET is forbidden', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', { user: staff });

    expect(response.status).toBe(403);
  });

  it('staff PUT is forbidden', async () => {
    const { response } = await requestAdmin('/settings/homepage-template', {
      user: staff,
      init: jsonPut({ homepage_template: 'discovery-first' }),
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

  it('manager PUT persists and audits the selected template in one batch', async () => {
    const { response, calls } = await requestAdmin('/settings/homepage-template', {
      init: jsonPut({ homepage_template: 'compact-ranking' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, homepage_template: 'compact-ranking' });
    expect(calls).toHaveLength(2);
    expect(calls.map(call => call.operation)).toEqual(['run', 'run']);
    expect(calls[0]).toMatchObject({
      sql: expect.stringContaining('INSERT INTO settings'),
      values: ['homepage_template', 'compact-ranking'],
    });
    expect(calls[1]).toMatchObject({
      sql: expect.stringContaining('INSERT INTO audit_logs'),
      values: expect.arrayContaining(['manager-1', 'update', 'settings', 'homepage_template']),
    });
  });
});

describe('public summary homepage template', () => {
  const summaryResponses = template => [
    { count: 3 },
    { total: 1000 },
    null,
    { recorded_at: '2026-09-01T00:00:00.000Z' },
    template,
  ];

  it('summary includes the saved template ID', async () => {
    const { response } = await requestPublic('/summary/', summaryResponses({ setting_value: 'compact-ranking' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ homepage_template: 'compact-ranking' });
  });

  it('summary defaults to ranking-first when no template is saved', async () => {
    const { response } = await requestPublic('/summary/', summaryResponses(null));

    await expect(response.json()).resolves.toMatchObject({ homepage_template: 'ranking-first' });
  });

  it('summary normalizes an invalid stored template', async () => {
    const { response } = await requestPublic('/summary/', summaryResponses({ setting_value: 'custom-layout' }));

    await expect(response.json()).resolves.toMatchObject({ homepage_template: 'ranking-first' });
  });
});
