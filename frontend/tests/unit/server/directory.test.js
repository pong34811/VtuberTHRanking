import { describe, expect, it, vi } from 'vitest';
import directory from '../../../server/directory.js';

function createDirectoryDb() {
  return {
    prepare: vi.fn(sql => ({
      bind: vi.fn(function bind() { return this; }),
      first: vi.fn(async () => ({ total: 2 })),
      all: vi.fn(async () => {
        if (sql.includes('SELECT v.id')) return { results: [] };
        if (sql.includes('SELECT category,')) return { results: [{ category: 'gaming', count: 2 }] };
        if (sql.includes('SELECT affiliation,')) return { results: [
          { affiliation: 'indie', count: 1 },
          { affiliation: 'agency', count: 1 },
        ] };
        throw new Error(`Unexpected query: ${sql}`);
      }),
    })),
  };
}

describe('directory endpoint', () => {
  it('returns active channel counts grouped by affiliation', async () => {
    const response = await directory.request('/', { method: 'GET' }, { DB: createDirectoryDb() });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      affiliation_counts: [
        { affiliation: 'indie', count: 1 },
        { affiliation: 'agency', count: 1 },
      ],
    });
  });
});
