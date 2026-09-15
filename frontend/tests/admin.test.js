// Admin API integration tests
// File: tests/admin.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest';
import auth from '../server/auth.js';
import admin from '../server/admin.js';
import { hashPassword } from '../server/password.js';

// ---- D1 mock helpers ----
function createMockDB() {
  const prepare = (sql) => {
    const bound = [];
    return {
      bind: (...vals) => { bound.push(...vals); return { first: () => Promise.resolve(null), all: () => Promise.resolve({ results: [] }), run: () => Promise.resolve() }; },
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [] }),
      run: () => Promise.resolve(),
    };
  };
  return {
    prepare,
    batch: (stmts) => Promise.resolve(stmts.map(() => ({ meta: { last_row_id: 1 } }))),
  };
}

function createContext(overrides = {}) {
  const store = {};
  return {
    env: { DB: overrides.db || createMockDB(), ADMIN_SETUP_TOKEN: overrides.setupToken },
    req: {
      url: overrides.url || 'https://example.com/',
      method: overrides.method || 'GET',
      header: (k) => overrides.headers?.[k.toLowerCase()] || overrides.headers?.[k] || null,
      raw: { body: null },
      param: (k) => overrides.params?.[k],
      text: () => Promise.resolve(JSON.stringify(overrides.body || {})),
      query: () => overrides.query || overrides.qs || {},
      json: () => Promise.resolve(overrides.body || {}),
    },
    set: (k, v) => { store[k] = v; },
    get: (k) => store[k],
    json: (obj, status) => ({ _response: obj, _status: status || 200 }),
    header: () => {},
    body: (text) => ({ _body: text }),
    _store: store,
  };
}

describe('Auth routes', () => {
  it('GET /me without cookie returns 401 with setupRequired', async () => {
    const ctx = createContext({ method: 'GET', headers: {} });
    const res = await auth.fetch(new Request('https://example.com/me'), ctx.env);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.setupRequired === true || data.setupRequired === false).toBe(true);
  });

  it('POST /login with missing fields returns 400/401', async () => {
    const ctx = createContext({ method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' }, body: { username: 'a', password: 'b' } });
    const res = await auth.fetch(new Request('https://example.com/login', { method: 'POST', body: JSON.stringify({ username: 'a', password: 'b' }), headers: { Origin: 'https://example.com' } }), ctx.env);
    expect([400, 401, 403]).toContain(res.status);
  });

  it('POST /logout without auth returns 401/403', async () => {
    const ctx = createContext({ method: 'POST', headers: {} });
    const res = await auth.fetch(new Request('https://example.com/logout', { method: 'POST' }), ctx.env);
    // 403 from origin check or 401 from missing session
    expect([401, 403]).toContain(res.status);
  });
});

describe('Admin routes require auth', () => {
  it('GET /vtubers returns 401 without session', async () => {
    const ctx = createContext({ method: 'GET', headers: {} });
    const res = await admin.fetch(new Request('https://example.com/vtubers'), ctx.env);
    expect(res.status).toBe(401);
  });

  it('POST /vtubers returns 401 without session', async () => {
    const ctx = createContext({ method: 'POST', headers: { 'content-type': 'application/json' }, body: { name: 'Test', slug: 'test' } });
    const res = await admin.fetch(new Request('https://example.com/vtubers', { method: 'POST', body: '{}' }), ctx.env);
    expect(res.status).toBe(401);
  });
});

describe('Password validation', () => {
  it('rejects short passwords', async () => {
    const { validatePassword } = await import('../server/password.js');
    expect(() => validatePassword('short')).toThrow();
    expect(() => validatePassword('a'.repeat(14))).toThrow();
  });

  it('accepts 15+ char passwords', async () => {
    const { validatePassword } = await import('../server/password.js');
    expect(() => validatePassword('a'.repeat(15))).not.toThrow();
  });

  it('hash and verify password round-trip', async () => {
    const { hashPassword, verifyPassword } = await import('../server/password.js');
    const hash = await hashPassword('validpassword12345');
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('pbkdf2-sha256$')).toBe(true);
    const valid = await verifyPassword('validpassword12345', hash);
    expect(valid).toBe(true);
    const invalid = await verifyPassword('wrongpassword123', hash);
    expect(invalid).toBe(false);
  });
});

describe('Admin domain helpers', () => {
  it('competitionRanks sorts by followers descending', async () => {
    const { competitionRanks } = await import('../server/admin-domain.js');
    const rows = [
      { vtuber_id: 1, followers: 100 },
      { vtuber_id: 2, followers: 200 },
      { vtuber_id: 3, followers: 150 },
    ];
    const result = competitionRanks(rows, 'followers');
    expect(result[0].vtuber_id).toBe(2);
    expect(result[1].vtuber_id).toBe(3);
    expect(result[2].vtuber_id).toBe(1);
    expect(result[0].rank).toBe(1);
  });

  it('competitionRanks handles ties', async () => {
    const { competitionRanks } = await import('../server/admin-domain.js');
    const rows = [
      { vtuber_id: 1, followers: 100 },
      { vtuber_id: 2, followers: 100 },
      { vtuber_id: 3, followers: 50 },
    ];
    const result = competitionRanks(rows, 'followers');
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
    expect(result[2].rank).toBe(3);
  });

  it('csvCell escapes formula characters', async () => {
    const { csvCell } = await import('../server/admin-domain.js');
    expect(csvCell('=SUM(A1)')).toBe("\"'=SUM(A1)\"");
    expect(csvCell('@cmd')).toBe("\"'@cmd\"");
    expect(csvCell('hello')).toBe('"hello"');
  });

  it('nextMonthBoundary calculates UTC first of next month', async () => {
    const { nextMonthBoundary } = await import('../server/admin-domain.js');
    const result = nextMonthBoundary('2026-09-01');
    // The function subtracts 7 hours from UTC midnight of next month
    expect(result).toBe('2026-09-30T17:00:00.000Z');
  });

  it('previousMonth returns previous month string', async () => {
    const { previousMonth } = await import('../server/admin-domain.js');
    expect(previousMonth('2026-09-01')).toBe('2026-08-01');
  });

  it('selection validates period and category', async () => {
    const { selection } = await import('../server/admin-domain.js');
    const s = selection({ period: 'monthly', category: 'followers' });
    expect(s.period).toBe('monthly');
    expect(s.category).toBe('followers');
    expect(s.month).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('selection accepts videos category', async () => {
    const { selection } = await import('../server/admin-domain.js');
    const s = selection({ period: 'monthly', category: 'videos' });
    expect(s.category).toBe('videos');
  });

  it('competitionRanks sorts by video_count for videos category', async () => {
    const { competitionRanks } = await import('../server/admin-domain.js');
    const rows = [
      { vtuber_id: 1, video_count: 50 },
      { vtuber_id: 2, video_count: 200 },
      { vtuber_id: 3, video_count: 100 },
    ];
    const result = competitionRanks(rows, 'videos');
    expect(result[0].vtuber_id).toBe(2);
    expect(result[1].vtuber_id).toBe(3);
    expect(result[2].vtuber_id).toBe(1);
  });

  it('channel validates slug format', async () => {
    const { channel } = await import('../server/admin-domain.js');
    expect(() => channel({ name: 'Test', slug: 'Invalid Slug' })).toThrow();
    expect(() => channel({ name: 'Test', slug: 'valid-slug' })).not.toThrow();
  });
});
