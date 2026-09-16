import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import admin from '../../server/admin.js';
import { createD1Stub } from '../helpers/d1.js';

function adminRequest(path, init = {}) {
  const { db } = createD1Stub();
  return admin.fetch(new Request(`https://example.com${path}`, init), { DB: db });
}

const staff = { id: 'u1', role: 'staff', status: 'active' };

async function authedRequest(path, { user = staff, responses = [], init = {}, env = {} } = {}) {
  const { calls, db } = createD1Stub(responses);
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', user);
    await next();
  });
  app.route('/', admin);
  const response = await app.fetch(new Request(`https://example.com${path}`, init), { DB: db, ...env });
  return { calls, response };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const post = body => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('admin API authentication', () => {
  it('rejects an unauthenticated read request', async () => {
    const response = await adminRequest('/vtubers');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required' });
  });

  it('rejects an unauthenticated write request', async () => {
    const response = await adminRequest('/vtubers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', slug: 'test' }),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required' });
  });
});

describe('admin channels CRUD', () => {
  it('rejects a deactivated user', async () => {
    const { response } = await authedRequest('/vtubers', { user: { ...staff, status: 'inactive' } });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Authentication required' });
  });

  it('lists channels for an authenticated user', async () => {
    const rows = [{ id: 1, name: 'Aiko', slug: 'aiko' }];
    const { response } = await authedRequest('/vtubers', { responses: [{ results: rows }] });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: rows });
  });

  it('creates a channel with valid data', async () => {
    const { response } = await authedRequest('/vtubers', {
      responses: [{ meta: { last_row_id: 5 } }, {}],
      init: post({ name: 'Aiko', slug: 'aiko' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 5 });
  });

  it('rejects a channel with an invalid slug', async () => {
    const { response } = await authedRequest('/vtubers', {
      init: post({ name: 'Aiko', slug: 'Bad Slug!' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Slug must use lowercase letters, numbers and hyphens' });
  });

  it('updates an existing channel', async () => {
    const { response } = await authedRequest('/vtubers/1', {
      responses: [{ id: 1, name: 'Aiko', slug: 'aiko' }, {}, {}],
      init: { ...post({ name: 'Aiko Updated', slug: 'aiko' }), method: 'PUT' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 1 });
  });

  it('returns 404 when updating a missing channel', async () => {
    const { response } = await authedRequest('/vtubers/99', {
      responses: [null],
      init: { ...post({ name: 'Ghost', slug: 'ghost' }), method: 'PUT' },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Record not found' });
  });

  it('rejects a non-numeric channel id', async () => {
    const { response } = await authedRequest('/vtubers/abc', {
      init: { ...post({ name: 'Aiko', slug: 'aiko' }), method: 'PUT' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid ID' });
  });

  it('rejects update payloads with fields outside the channel contract', async () => {
    const { response } = await authedRequest('/vtubers/1', {
      responses: [{ id: 1, name: 'Aiko', slug: 'aiko' }],
      init: { ...post({ id: 1, name: 'Aiko', slug: 'aiko' }), method: 'PUT' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Unknown field' });
  });
});

describe('admin channel snapshots', () => {
  const snapshot = { followers: 100, total_views: 1000, video_count: 10, recorded_at: '2026-09-01T00:00:00.000Z' };

  it('lists snapshots for a channel', async () => {
    const rows = [{ ...snapshot, vtuber_id: 1 }];
    const { response } = await authedRequest('/vtubers/1/snapshots', {
      responses: [{ id: 1 }, { results: rows }],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: rows });
  });

  it('records a snapshot with valid data', async () => {
    const { response } = await authedRequest('/vtubers/1/snapshots', {
      responses: [{ id: 1 }, {}, {}],
      init: post(snapshot),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('rejects a snapshot with negative followers', async () => {
    const { response } = await authedRequest('/vtubers/1/snapshots', {
      responses: [{ id: 1 }],
      init: post({ ...snapshot, followers: -1 }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Invalid followers' });
  });
});

describe('admin youtube import', () => {
  const key = { YOUTUBE_API_KEY: 'test-key' };
  const item = {
    id: 'UCabcdefghij1234567890AB',
    snippet: {
      title: 'Aiko Channel',
      description: 'Test channel',
      thumbnails: { medium: { url: 'https://img.example/a.jpg' } },
    },
    statistics: { subscriberCount: '1000', viewCount: '5000', videoCount: '50' },
  };
  const youtubeOk = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [item] }),
  }));

  it('requires a server API key', async () => {
    const { response } = await authedRequest('/youtube/import', { init: post({ input: '@aiko' }) });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: 'ยังไม่ได้ตั้งค่า YOUTUBE_API_KEY บนเซิร์ฟเวอร์' });
  });

  it('rejects input without a channel id or handle', async () => {
    youtubeOk();
    const { response } = await authedRequest('/youtube/import', {
      env: key,
      init: post({ input: '!!!' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'ใส่ channel ID, @handle หรือลิงก์ YouTube' });
  });

  it('reports a YouTube API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const { response } = await authedRequest('/youtube/import', {
      env: key,
      init: post({ input: '@aiko' }),
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'ดึงข้อมูลจาก YouTube ไม่สำเร็จ (403)' });
  });

  it('reports an unknown YouTube channel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }));
    const { response } = await authedRequest('/youtube/import', {
      env: key,
      init: post({ input: '@ghost' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'ไม่พบช่องนี้บน YouTube' });
  });

  it('creates a new channel from a handle', async () => {
    youtubeOk();
    const { calls, response } = await authedRequest('/youtube/import', {
      env: key,
      responses: [null, null, { meta: { last_row_id: 9 } }, {}, {}],
      init: post({ input: '@aiko' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true, id: 9, name: 'Aiko Channel', slug: 'aiko-channel',
      followers: 1000, total_views: 5000, video_count: 50,
    });
    expect(calls[0].values).toEqual(['https://www.youtube.com/channel/UCabcdefghij1234567890AB', 'https://www.youtube.com/channel/UCabcdefghij1234567890AB']);
  });

  it('updates an existing channel instead of duplicating', async () => {
    youtubeOk();
    const { response } = await authedRequest('/youtube/import', {
      env: key,
      responses: [{ id: 3 }, {}, {}, {}],
      init: post({ input: 'UCabcdefghij1234567890AB' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, id: 3, updated: true });
  });
});
