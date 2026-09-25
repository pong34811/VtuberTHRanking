import { describe, expect, it } from 'vitest';
import publicApi from '../../server/public.js';
import { createD1Stub } from '../helpers/d1.js';

async function request(path, responses = []) {
  const { db, calls } = createD1Stub(responses);
  const response = await publicApi.fetch(new Request('https://example.com' + path), { DB: db });
  return { response, calls };
}

describe('metadata directory API', () => {
  it('returns only directory fields and global category counts', async () => {
    const creator = { id: 1, name: 'Aiko', slug: 'aiko', avatar: '', category: 'gaming', affiliation: 'agency', agency_name: 'PIXELA', created_at: '2026-09-01 00:00:00' };
    const { response, calls } = await request('/directory/?limit=1', [
      { total: 3 },
      { results: [{ ...creator, followers: 999, notes: 'private' }] },
      { results: [{ category: 'gaming', count: 3 }] },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      total: 3,
      count: 1,
      limit: 1,
      offset: 0,
      results: [creator],
      category_counts: [{ category: 'gaming', count: 3 }],
    });
    expect(calls.map(call => call.sql).join(' ')).not.toMatch(/stats_snapshots|rankings|followers|rank_change/);
    expect(calls.find(call => call.operation === 'all').sql).toContain('v.agency_name');
  });

  it.each(['category=unknown', 'affiliation=unknown'])('rejects %s before querying', async query => {
    const { response, calls } = await request('/directory/?' + query);

    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it.each([
    ['limit=1000&offset=2', 100, 2],
    ['limit=0&offset=-1', 1, 0],
    ['limit=abc&offset=9007199254740992', 12, 0],
  ])('bounds %s', async (query, limit, offset) => {
    const { response } = await request('/directory/?' + query, [
      { total: 0 },
      { results: [] },
      { results: [] },
    ]);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ limit, offset, count: 0, results: [] });
  });
});
