import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendDatabase, mountedRequest, seedUser, staffToken } from '../helpers/backend-sqlite.js';

const stores = [];
const database = () => { const store = backendDatabase(); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('mounted streaming body limits', () => {
  it.each(['/auth/login', '/compare/'])('caps UTF-8 bytes before parsing %s, even with a false Content-Length', async path => {
    const store = database();
    const rawBody = JSON.stringify({ username: 'admin', password: 'wrong-password', vtubers: [1, 2], padding: 'ก'.repeat(24000) });
    const result = await mountedRequest(store, path, { method: 'POST', rawBody, headers: { 'Content-Length': '2' } });
    expect(result.status).toBe(413);
    expect(result.body.message).toBe('Request body too large');
    expect(store.calls.some(call => /users|auth_attempts|stats_snapshots/.test(call.sql))).toBe(false);
  });
});

describe('mounted credentialed CORS', () => {
  it.each([
    ['https://vtuberthai-ranking.pages.dev', true],
    ['https://preview-abc.vtuberthai-ranking.pages.dev', true],
    ['https://evilvtuberthai-ranking.pages.dev', false],
    ['https://vtuberthai-ranking.pages.dev.evil.invalid', false],
    ['http://vtuberthai-ranking.pages.dev', false],
    ['http://localhost:5173', false],
    ['http://localhost:4173', false],
  ])('uses the exact project boundary for %s', async (origin, allowed) => {
    const result = await mountedRequest(null, '/', { headers: { Origin: origin }, env: { ENVIRONMENT: 'production' } });
    expect(result.status).toBe(200);
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(allowed ? origin : null);
  });
  it('allows the explicit development origin only in development', async () => {
    const origin = 'http://localhost:5173';
    const result = await mountedRequest(null, '/', { headers: { Origin: origin }, env: { ENVIRONMENT: 'development' } });
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });
});

describe('actual mounted authentication boundaries', () => {
  it('preserves unauthenticated, role, CSRF, exact-origin and expiry rejection with no writes', async () => {
    const store = database();
    seedUser(store);
    seedUser(store, { id: 'staff', role: 'staff', token: staffToken });
    expect((await mountedRequest(store, '/admin/users')).status).toBe(401);
    expect((await mountedRequest(store, '/admin/users', { authenticated: true, token: staffToken })).status).toBe(403);
    for (const headers of [{ 'X-CSRF-Token': 'wrong' }, { Origin: 'https://preview-abc.vtuberthai-ranking.pages.dev' }]) {
      expect((await mountedRequest(store, '/admin/vtubers', { method: 'POST', authenticated: true, headers, payload: { name: 'Rejected', slug: 'rejected' } })).status).toBe(403);
    }
    store.sql.exec('UPDATE sessions SET expires_at=0');
    expect((await mountedRequest(store, '/admin/vtubers', { authenticated: true })).status).toBe(401);
    expect((await mountedRequest(store, '/auth/me', { authenticated: true })).status).toBe(401);
    expect(store.sql.prepare('SELECT COUNT(*) AS count FROM vtubers').get().count).toBe(0);
    expect(store.sql.prepare('SELECT COUNT(*) AS count FROM audit_logs').get().count).toBe(0);
  });

  it('returns Retry-After on account and IP limits and clears the fixed window', async () => {
    const store = database();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    const login = ip => mountedRequest(store, '/auth/login', { method: 'POST', payload: { username: 'some-user', password: 'wrong-password' }, headers: { 'CF-Connecting-IP': ip } });
    for (let i = 0; i < 10; i++) expect((await login(`192.0.2.${i}`)).status).toBe(401);
    const accountLimited = await login('198.51.100.1');
    expect(accountLimited.status).toBe(429);
    expect(accountLimited.headers.get('Retry-After')).toBe('900');
    const rows = store.sql.prepare('SELECT key FROM auth_attempts').all();
    expect(rows.every(row => /^[a-f0-9]{64}$/.test(row.key))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('some-user');
    expect(JSON.stringify(rows)).not.toContain('192.0.2');
    vi.setSystemTime(new Date('2026-09-15T12:15:01Z'));
    expect((await login('198.51.100.1')).status).toBe(401);
    for (let i = 0; i < 29; i++) {
      await mountedRequest(store, '/auth/login', { method: 'POST', payload: { username: `other-${i}`, password: 'wrong-password' }, headers: { 'CF-Connecting-IP': '198.51.100.1' } });
    }
    const ipLimited = await login('198.51.100.1');
    expect(ipLimited.status).toBe(429);
    expect(ipLimited.headers.get('Retry-After')).toBe('900');
  });

  it('does not log raw provider errors or request secrets', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'https://provider.invalid/?key=private-key password=secret-body';
    const broken = { prepare() { throw new Error(secret); } };
    const result = await mountedRequest(null, '/auth/me', { authenticated: true, env: { DB: broken } });
    expect(result.status).toBe(500);
    expect(result.headers.get('Content-Type')).toContain('application/json');
    const logged = log.mock.calls.flat().map(value => value instanceof Error ? `${value.message} ${value.stack}` : JSON.stringify(value)).join(' ');
    expect(logged).not.toContain('private-key');
    expect(logged).not.toContain('secret-body');
    expect(log).toHaveBeenCalled();
  });
});

describe('production preview isolation', () => {
  it.each(['/site-config/', '/summary/', '/admin/users', '/auth/me'])('refuses DB access on an unconfigured preview for %s', async path => {
    const store = database();
    const origin = 'https://preview-abc.vtuberthai-ranking.pages.dev';
    const result = await mountedRequest(store, path, { host: 'preview-abc.vtuberthai-ranking.pages.dev', headers: { Origin: origin }, env: { ENVIRONMENT: 'production' } });
    expect(result.status).toBe(503);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(result.headers.get('X-Robots-Tag')).toContain('noindex');
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(store.calls).toEqual([]);
  });

  it.each(['staging', 'development'])('allows an explicitly configured %s preview', async environment => {
    const store = database();
    const result = await mountedRequest(store, '/site-config/', { host: 'preview-abc.vtuberthai-ranking.pages.dev', env: { ENVIRONMENT: environment } });
    expect(result.status).toBe(200);
    expect(store.calls.length).toBeGreaterThan(0);
  });

  it('does not block canonical or local lab API access', async () => {
    const store = database();
    for (const host of ['vtuberthai-ranking.pages.dev', 'test.invalid']) {
      expect((await mountedRequest(store, '/site-config/', { host, env: { ENVIRONMENT: 'production' } })).status).toBe(200);
    }
  });
});
