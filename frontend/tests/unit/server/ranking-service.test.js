import { describe, expect, it } from 'vitest';
import { calculateRanking } from '../../../server/ranking-service.js';

function rankingDb({ rows, previous = [] }) {
  const batches = [];
  const queries = [];
  const db = {
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) { this.values = values; return this; },
        async all() {
          queries.push({ sql, values: this.values });
          return { results: sql.includes('FROM vtubers v') ? rows : previous };
        },
      };
      return statement;
    },
    async batch(statements) { batches.push(statements); },
  };
  return { db, batches, queries };
}

describe('calculateRanking', () => {
  it('selects the monthly snapshot before Bangkok month-end and publishes a single metric atomically', async () => {
    const { db, batches, queries } = rankingDb({
      rows: [
        { vtuber_id: 1, followers: 100, total_views: 300, video_count: 10 },
        { vtuber_id: 2, followers: 200, total_views: 200, video_count: 20 },
      ],
      previous: [{ vtuber_id: 1, rank: 1 }],
    });

    await expect(calculateRanking(db, {
      period: 'monthly', month: '2026-09-01', category: 'followers',
    })).resolves.toEqual({ count: 2 });

    expect(queries[0].values).toEqual(['2026-09-30T17:00:00.000Z', '2026-09-30T17:00:00.000Z']);
    expect(queries[1].values).toEqual(['monthly', 'followers', '2026-08-01']);
    expect(batches).toHaveLength(1);
    expect(batches[0][0].sql).toContain('DELETE FROM rankings');
    expect(batches[0][1].values.slice(0, 3)).toEqual(['monthly', 'followers', '2026-09-01']);
    expect(JSON.parse(batches[0][1].values[3])).toEqual([
      { vtuber_id: 2, rank: 1, score: 200, rank_change: null, followers: 200, total_views: 200, video_count: 20 },
      { vtuber_id: 1, rank: 2, score: 100, rank_change: -1, followers: 100, total_views: 300, video_count: 10 },
    ]);
  });

  it('publishes over 90 active channels using a bounded JSON bulk statement', async () => {
    const { db, batches } = rankingDb({ rows: Array.from({ length: 91 }, (_, index) => ({ vtuber_id: index + 1, followers: 10 })) });

    await expect(calculateRanking(db, {
      period: 'alltime', month: null, category: 'followers',
    })).resolves.toEqual({ count: 91 });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0][1].values).toHaveLength(4);
    expect(JSON.parse(batches[0][1].values[3])).toHaveLength(91);
  });
});
