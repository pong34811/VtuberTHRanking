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
    expect(batches[0].slice(1).map(statement => statement.values)).toEqual([
      [2, 'monthly', 'followers', '2026-09-01', 1, 200, null, 200, 200, 20],
      [1, 'monthly', 'followers', '2026-09-01', 2, 100, -1, 100, 300, 10],
    ]);
  });

  it('rejects over 90 active channels before publishing any rows', async () => {
    const { db, batches } = rankingDb({ rows: Array.from({ length: 91 }, (_, index) => ({ vtuber_id: index + 1, followers: 10 })) });

    await expect(calculateRanking(db, {
      period: 'alltime', month: null, category: 'followers',
    })).rejects.toMatchObject({ code: 'RANKING_CHANNEL_LIMIT' });
    expect(batches).toHaveLength(0);
  });
});
