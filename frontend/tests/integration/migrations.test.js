import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

let runtime;
afterEach(async () => { await runtime?.dispose(); });

function statements(name) {
  // Match Wrangler's execution: D1 owns the transaction around the batch.
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8')
    .replace(/\bBEGIN TRANSACTION\s*;/gi, '')
    .replace(/\bCOMMIT\s*;/gi, '')
    .replace(/^\s*--.*$/gm, '')
    .split(';').map(sql => sql.trim()).filter(Boolean);
}

async function database() {
  runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default { fetch() { return new Response("migration test"); } };',
    compatibilityDate: '2026-09-15',
    rootPath: process.env.TMPDIR || process.cwd(),
    d1Databases: { DB: 'migration-test' },
    d1Persist: false,
  }));
  const db = await runtime.getD1Database('DB');
  for (const name of ['0001_existing_schema.sql', '0002_admin.sql']) {
    await db.batch(statements(name).map(sql => db.prepare(sql)));
  }
  return db;
}

it('upgrades populated D1 categories without dropping referencing reports or ranking data', async () => {
  const db = await database();
  await db.batch([
    db.prepare("INSERT INTO users (id,username,password_hash,display_name,email,role,status) VALUES ('fixture-user','fixture-user','not-a-login-hash','Fixture','fixture@example.invalid','manager','active')"),
    db.prepare("INSERT INTO reports (id,report_type,report_period,category_id,total_vtubers,generated_by,snapshot_json) VALUES ('fixture-report','monthly','2026-09','followers',1,'fixture-user','[]')"),
    db.prepare("INSERT INTO vtubers (id,name,slug,channel_url) VALUES (1,'Fixture','fixture','https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')"),
    db.prepare("INSERT INTO rankings (vtuber_id,period,category,rank,score,month) VALUES (1,'monthly','followers',1,100,'2026-09-01')"),
    db.prepare("INSERT INTO stats_snapshots (vtuber_id,followers,recorded_at) VALUES (1,100,'2026-09-01 12:00:00')"),
  ]);

  await expect(db.batch(statements('0003_videos_category.sql').map(sql => db.prepare(sql)))).resolves.toBeDefined();
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  expect(await db.prepare("SELECT category_id,snapshot_json FROM reports WHERE id='fixture-report'").first()).toEqual({ category_id: 'followers', snapshot_json: '[]' });
  expect((await db.prepare('SELECT id FROM categories ORDER BY id').all()).results.map(row => row.id)).toEqual(['followers', 'videos', 'views']);
  expect(await db.prepare('SELECT score FROM rankings WHERE vtuber_id=1').first()).toEqual({ score: 100 });
  expect(await db.prepare('SELECT followers FROM stats_snapshots WHERE vtuber_id=1').first()).toEqual({ followers: 100 });
  await expect(db.prepare("DELETE FROM categories WHERE id='followers'").run()).rejects.toThrow(/FOREIGN KEY/);
}, 30_000);

it('indexes mixed timestamp ordering and Bangkok daily rollups on actual D1', async () => {
  const db = await database();
  await db.batch(statements('0003_videos_category.sql').map(sql => db.prepare(sql)));
  await db.batch(statements('0006_ranking_pipeline_runs.sql').map(sql => db.prepare(sql)));
  await db.batch(statements('0009_snapshot_query_indexes.sql').map(sql => db.prepare(sql)));
  await db.batch([
    db.prepare("INSERT INTO vtubers (id,name,slug,channel_url) VALUES (1,'Fixture','fixture','https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')"),
    db.prepare("INSERT INTO stats_snapshots (vtuber_id,followers,recorded_at) VALUES (1,100,'2026-09-01T08:00:00.000Z')"),
    db.prepare("INSERT INTO stats_snapshots (vtuber_id,followers,recorded_at) VALUES (1,90,'2026-09-01 12:00:00')"),
  ]);
  expect(await db.prepare('SELECT followers FROM stats_snapshots WHERE vtuber_id=1 ORDER BY julianday(recorded_at) DESC,id DESC LIMIT 1').first()).toEqual({ followers: 90 });
  const plan = (await db.prepare('EXPLAIN QUERY PLAN SELECT id FROM stats_snapshots WHERE vtuber_id=1 ORDER BY julianday(recorded_at) DESC,id DESC LIMIT 1').all()).results;
  expect(plan.some(row => row.detail.includes('snapshots_chronological_latest'))).toBe(true);
  expect((await db.prepare('PRAGMA index_list(stats_snapshots)').all()).results.some(row => row.name === 'snapshots_bangkok_day')).toBe(true);
}, 30_000);

it('applies the reliable ranking publication chain end to end on actual D1', async () => {
  const db = await database();
  for (const name of ['0003_videos_category.sql', '0004_channel_notes.sql', '0005_agencies.sql', '0006_ranking_pipeline_runs.sql', '0007_auth_attempts_expiry.sql', '0008_reliable_ranking_publication.sql', '0009_snapshot_query_indexes.sql']) {
    await db.batch(statements(name).map(sql => db.prepare(sql)));
  }
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
  expect(await db.prepare('SELECT COUNT(*) AS count FROM ranking_pipeline_lease WHERE id=1').first()).toEqual({ count: 1 });
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ranking_pipeline_snapshots','ranking_publications','ranking_publication_rows','ranking_month_finalizations','ranking_pipeline_assertions')").all()).results.map(row => row.name).sort();
  expect(tables).toEqual(['ranking_month_finalizations', 'ranking_pipeline_assertions', 'ranking_pipeline_snapshots', 'ranking_publication_rows', 'ranking_publications']);
  expect((await db.prepare('PRAGMA index_list(rankings)').all()).results.some(row => row.name === 'rankings_public_lookup')).toBe(true);
}, 60_000);
