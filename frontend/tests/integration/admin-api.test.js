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

describe('admin agencies CRUD', () => {
  it('lists agencies with channel counts', async () => {
    const agencies = [{ id: 2, name: 'PIXELA', channel_count: 3 }];
    const { response } = await authedRequest('/agencies', { responses: [{ results: agencies }] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: agencies });
  });

  it('creates an agency', async () => {
    const { response, calls } = await authedRequest('/agencies', {
      responses: [{ meta: { last_row_id: 2 } }, {}],
      init: post({ name: 'PIXELA', description: 'VTuber agency', image_url: 'https://example.com/logo.png', contact: 'https://example.com' }),
    });
    expect(response.status).toBe(201);
    expect(calls.some(call => call.sql.includes('INSERT INTO agencies'))).toBe(true);
  });

  it('rejects deletion while channels use an agency', async () => {
    const { response } = await authedRequest('/agencies/2', {
      responses: [{ id: 2 }, { total: 1 }],
      init: { method: 'DELETE' },
    });
    expect(response.status).toBe(409);
  });

  it('rejects a channel with a missing agency', async () => {
    const { response } = await authedRequest('/vtubers', {
      responses: [null],
      init: post({ name: 'Aiko', slug: 'aiko', affiliation: 'agency', agency_id: 999 }),
    });
    expect(response.status).toBe(400);
  });

  it('imports an agency from its official YouTube channel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'UC' + 'a'.repeat(22), snippet: { title: 'PIXELA', description: 'Agency', thumbnails: { high: { url: 'https://example.com/p.png' } } } }] }),
    }));
    const { response, calls } = await authedRequest('/agencies/youtube/import', {
      env: { YOUTUBE_API_KEY: 'test-key' },
      responses: [null, { meta: { last_row_id: 2 } }, {}],
      init: post({ input: '@pixela' }),
    });
    expect(response.status).toBe(201);
    expect(calls.find(call => call.sql.includes('INSERT INTO agencies')).values.slice(0, 4))
      .toEqual(['PIXELA', 'Agency', 'https://example.com/p.png', `https://www.youtube.com/channel/UC${'a'.repeat(22)}`]);
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

describe('admin ranking pipeline history', () => {
  const manager = { id: 'u2', role: 'manager', status: 'active' };

  it('limits pipeline history to managers', async () => {
    const { response } = await authedRequest('/pipeline-runs');

    expect(response.status).toBe(403);
  });

  it('returns recent pipeline outcomes to a manager', async () => {
    const runs = [{
      id: 'run-1', trigger_source: 'scheduled', frequency: 'weekly', status: 'partial',
      channels_total: 8, snapshots_written: 7, rankings_published: 4,
    }];
    const { response, calls } = await authedRequest('/pipeline-runs', {
      user: manager,
      responses: [{ results: runs }],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: runs });
    expect(calls[0].sql).toContain('FROM ranking_pipeline_runs');
    expect(calls[0].sql).toContain('LIMIT 10');
  });
});
