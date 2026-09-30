import { afterEach, describe, expect, it } from 'vitest';
import { calculateRanking } from '../../server/ranking-service.js';
import { createSqliteD1 } from '../helpers/sqlite-d1.js';

const databases = [];
afterEach(() => databases.splice(0).forEach(database => database.close()));
function database() { const database = createSqliteD1(); databases.push(database); return database; }
function seed(database, count = 1) {
  const channel = database.sqlite.prepare('INSERT INTO vtubers(id,name,slug,channel_url,platform,is_active) VALUES (?,?,?,?,?,1)');
  const snapshot = database.sqlite.prepare('INSERT INTO stats_snapshots(vtuber_id,followers,total_views,video_count,recorded_at) VALUES (?,?,?,?,?)');
  for (let id = 1; id <= count; id++) {
    channel.run(id, `Channel ${id}`, `channel-${id}`, `https://youtube.com/channel/UC${String(id).padStart(22, '0')}`, 'youtube');
    snapshot.run(id, id, id * 100, id * 2, '2026-09-01T08:00:00.000Z');
  }
}

describe('real SQL ranking publication', () => {
  it('excludes inactive and non-YouTube historical snapshots', async () => {
    const database = databaseForTest();
    seed(database, 3);
    database.sqlite.exec("UPDATE vtubers SET platform='twitch' WHERE id=2; UPDATE vtubers SET is_active=0 WHERE id=3");
    await calculateRanking(database.db, { period: 'alltime', category: 'followers', month: null });
    expect(database.sqlite.prepare('SELECT vtuber_id,score FROM rankings').all()).toEqual([{ vtuber_id: 1, score: 1 }]);
  });
  it('publishes 251 channels with bounded SQL and bindings, not one statement per row', async () => {
    const database = databaseForTest();
    seed(database, 251);
    await expect(calculateRanking(database.db, { period: 'alltime', category: 'followers', month: null })).resolves.toEqual({ count: 251 });
    expect(database.sqlite.prepare('SELECT COUNT(*) AS count FROM rankings').get().count).toBe(251);
    expect(database.calls.filter(call => call.sql.includes('INSERT INTO rankings')).length).toBeLessThanOrEqual(3);
    expect(database.calls.every(call => call.values.length <= 100)).toBe(true);
  });
});
const databaseForTest = database;
