import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { syncDirectory as syncSQLiteDirectory } from '../../../worker/directory-sync.js';
import { backendDatabase, mountedRequest, seedUser, staffToken } from '../helpers/backend-sqlite.js';

const id = letter => `UC${letter.repeat(22)}`;
const url = letter => `https://www.youtube.com/channel/${id(letter)}`;
const fixtures = {
  [id('a')]: { id: id('a'), snippet: { title: 'Current title', description: 'Channel bio', thumbnails: { medium: { url: 'https://images.example/avatar.png' } } }, statistics: { subscriberCount: '10', viewCount: '100', videoCount: '2' } },
  [id('p')]: { id: id('p'), snippet: { title: 'Pixela member', description: 'Primary channel description', thumbnails: {} }, statistics: { subscriberCount: '20', viewCount: '200', videoCount: '3' } },
  [id('g')]: { id: id('g'), snippet: { title: 'Graduated member', description: 'Former member', thumbnails: {} }, statistics: { subscriberCount: '30', viewCount: '300', videoCount: '4' } },
  [id('i')]: { id: id('i'), snippet: { title: 'Independent creator', description: 'Independent Thai VTuber', thumbnails: {} }, statistics: { subscriberCount: '40', viewCount: '400', videoCount: '5' } },
  [id('u')]: { id: id('u'), snippet: { title: 'Unverified creator', description: 'Games and entertainment', thumbnails: {} }, statistics: { subscriberCount: '50', viewCount: '500', videoCount: '6' } },
};
let script;
const runtimes = [];
const stores = [];
beforeAll(async () => {
  const built = await build({
    configFile: false, logLevel: 'silent',
    plugins: [{ name: 'directory-test-entry', resolveId(value) { if (value.endsWith('directory-test-entry')) return '\0directory-test-entry'; },
      load(value) { if (value === '\0directory-test-entry') return `import updater from ${JSON.stringify(fileURLToPath(new URL('../../../worker/updater.js', import.meta.url)).replaceAll('\\', '/'))}; import {syncDirectory} from ${JSON.stringify(fileURLToPath(new URL('../../../worker/directory-sync.js', import.meta.url)).replaceAll('\\', '/'))};
      export default {async fetch(request,env) { const u=new URL(request.url);
        const metadata={scheduledTime:Date.parse(u.searchParams.get('time')||'2026-10-05T02:00:00Z')};
        if(u.pathname==='/scheduled') {await updater.scheduled(metadata,env);return Response.json({ok:true});}
        return Response.json(await syncDirectory(env,metadata)); }};`; } }],
    build: { write: false, minify: false, lib: { entry: 'directory-test-entry', formats: ['es'], fileName: 'directory-test' } },
  });
  script = (Array.isArray(built) ? built[0] : built).output.find(file => file.type === 'chunk').code;
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); stores.splice(0).forEach(store => store.close()); await Promise.all(runtimes.splice(0).map(runtime => runtime.dispose())); });

async function setup({ enabled = true, existing = true } = {}) {
  const state = { searchPage: null, handleItems: {}, items: structuredClone(fixtures), searchFails: false, onChannels: null };
  const network = vi.fn(async request => {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.endsWith('/search')) {
      if (state.searchFails) return new Response('', { status: 403 });
      if (state.searchPage) return Response.json(await state.searchPage(requestUrl));
      return Response.json({ items: ['i','u'].map(letter => ({ id: { channelId: id(letter),videoId: 'abcdefghijk' },snippet: { channelId: id(letter) } })) });
    }
    await state.onChannels?.(requestUrl);
    const ids = requestUrl.searchParams.get('id')?.split(',') || [state.handleItems[requestUrl.searchParams.get('forHandle')] || id(requestUrl.searchParams.get('forHandle') === '@active' ? 'p' : 'g')];
    return Response.json({ items: ids.map(channelId => state.items[channelId]).filter(Boolean) });
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script, compatibilityDate: '2026-09-15', cf: false,
    rootPath: tmpdir(), resourceTmpPath: `${tmpdir()}/directory-sync-${randomUUID()}`,
    d1Databases: { DB: 'directory-sync-test' }, d1Persist: false,
    bindings: { YOUTUBE_API_KEY: 'synthetic-only' }, outboundService: network,
  }));
  runtimes.push(runtime);
  const db = await runtime.getD1Database('DB');
  const directory = new URL('../../migrations/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    const statements = readFileSync(new URL(name, directory), 'utf8').replace(/\bBEGIN TRANSACTION\s*;/gi, '').replace(/\bCOMMIT\s*;/gi, '').replace(/^\s*--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean);
    await db.batch(statements.map(sql => db.prepare(sql)));
  }
  await db.prepare("UPDATE settings SET setting_value=? WHERE setting_key='directory_sync_enabled'").bind(String(enabled)).run();
  await db.prepare("UPDATE settings SET setting_value='daily' WHERE setting_key='ranking_update_frequency'").run();
  if (existing) await db.prepare("INSERT INTO vtubers(id,name,slug,bio,channel_url,youtube_url) VALUES (1,'Editorial name','editorial','Editorial bio',?,?)").bind(url('a'), url('a')).run();
  const sync = async (time = '2026-10-05T02:00:00Z', path = '/sync') => {
    const response = await runtime.dispatchFetch(`https://test.invalid${path}?time=${encodeURIComponent(time)}`);
    expect(response.status).toBe(200);
    return response.json();
  };
  return { runtime, db, state, network, sync };
}

it('queues every discovery, preserves editorial fields, and publishes statistics only for registered channels', async () => {
  const { db, sync, network } = await setup();
  expect(await sync()).toMatchObject({ ok: true, status: 'succeeded', profilesChecked: 1, channelsAdded: 0, candidatesPending: 2, candidatesNew: 2 });
  const creators = (await db.prepare('SELECT name,bio,affiliation,agency_name,debut_date FROM vtubers ORDER BY id').all()).results;
  expect(creators).toEqual([
    { name: 'Editorial name', bio: 'Editorial bio', affiliation: 'indie', agency_name: '', debut_date: '' },
  ]);
  expect((await db.prepare('SELECT name FROM directory_candidates WHERE status=\'pending\' ORDER BY name').all()).results)
    .toEqual([{ name: 'Independent creator' }, { name: 'Unverified creator' }]);
  expect(network.mock.calls.every(([request]) => new URL(request.url).hostname === 'www.googleapis.com')).toBe(true);
  const calls = network.mock.calls.length;
  expect(await sync('2026-10-05T16:59:59Z')).toEqual({ ok: true, skipped: 'not due' });
  expect(network).toHaveBeenCalledTimes(calls);
  await sync('2026-10-05T02:00:00Z', '/scheduled');
  expect(await db.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').first()).toEqual({ n: 1 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM rankings').first()).toEqual({ n: 6 });
  await sync('2026-10-05T02:00:00Z', '/scheduled');
  expect(await db.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').first()).toEqual({ n: 1 });
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
}, 30_000);

it('updates fields still matching the last source while protecting concurrent edits, inactive channels and deletion tombstones', async () => {
  const { db, sync, state } = await setup();
  await sync();
  await db.prepare("UPDATE vtubers SET name='Current title',bio='Channel bio' WHERE id=1").run();
  state.items[id('a')].snippet.title = 'New source title';
  state.items[id('a')].snippet.description = 'New source bio';
  state.onChannels = async requestUrl => {
    if (requestUrl.searchParams.get('id')?.includes(id('a'))) {
      await db.prepare("UPDATE vtubers SET bio='Concurrent edit' WHERE id=1").run();
    }
  };
  await db.prepare("INSERT INTO vtubers(name,slug,youtube_url,channel_url,is_active) VALUES ('Pixela member','pixela',?,?,0)").bind(url('p'),url('p')).run();
  await db.prepare("UPDATE directory_candidates SET status='imported' WHERE channel_id=?").bind(id('i')).run();
  expect(await sync('2026-10-05T17:00:00Z')).toMatchObject({ ok: true, channelsAdded: 0 });
  expect(await db.prepare('SELECT name,bio,slug FROM vtubers WHERE id=1').first()).toEqual({ name: 'New source title', bio: 'Concurrent edit', slug: 'editorial' });
  expect(await db.prepare("SELECT is_active FROM vtubers WHERE name='Pixela member'").first()).toEqual({ is_active: 0 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM vtubers').first()).toEqual({ n: 2 });
  expect(await db.prepare('SELECT day FROM directory_sync_runs ORDER BY day DESC LIMIT 1').first()).toEqual({ day: '2026-10-06' });
}, 30_000);

it('retains good profiles during malformed metadata, retries search failures and still runs statistics', async () => {
  const { db, sync, state } = await setup();
  state.searchFails = true;
  state.items[id('a')].snippet.title = '';
  expect(await sync()).toMatchObject({ ok: false, status: 'partial', channelsAdded: 0 });
  expect(await db.prepare('SELECT name FROM vtubers WHERE id=1').first()).toEqual({ name: 'Editorial name' });
  await sync('2026-10-05T02:00:00Z', '/scheduled');
  expect(await db.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').first()).toEqual({ n: 1 });
  state.searchFails = false; state.items[id('a')].snippet.title = 'Current title';
  expect(await sync()).toMatchObject({ ok: true, status: 'succeeded', channelsAdded: 0 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM vtubers').first()).toEqual({ n: 1 });
}, 30_000);

it('keeps hidden-counter candidates pending, honors ignored candidates and serializes concurrent runs', async () => {
  const { db, sync, state } = await setup({ existing: false });
  state.items[id('u')].statistics.hiddenSubscriberCount = true;
  await db.prepare("INSERT INTO directory_candidates(channel_id,name,source_url,reference_url,reason,status,checked_at) VALUES (?,'Ignored',?,?,'Manager decision','ignored',datetime('now'))")
    .bind(id('i'), url('i'), url('i')).run();
  const results = await Promise.all([sync(), sync()]);
  expect(results.some(result => result.skipped === 'in progress' || result.skipped === 'not due')).toBe(true);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM vtubers').first()).toEqual({ n: 0 });
  expect(await db.prepare('SELECT reason FROM directory_candidates WHERE channel_id=?').bind(id('u')).first()).toEqual({ reason: 'YouTube subscriber count is hidden' });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM directory_sync_runs').first()).toEqual({ n: 1 });
}, 30_000);

it('stays disabled until configured and enforces manager, CSRF and atomic audit on candidate decisions', async () => {
  const { sync, network } = await setup({ enabled: false });
  expect(await sync()).toEqual({ ok: true, skipped: 'disabled' }); expect(network).not.toHaveBeenCalled();
  const store = backendDatabase(); stores.push(store); seedUser(store); seedUser(store, { id: 'staff', role: 'staff', token: staffToken });
  const candidatePath = `/admin/directory-candidates/${id('i')}/ignore`;
  store.sql.prepare("INSERT INTO directory_candidates(channel_id,name,source_url,reference_url,reason,status,checked_at) VALUES (?,'Pending',?,?,'Needs evidence','pending',datetime('now'))").run(id('i'), url('i'), url('i'));
  expect((await mountedRequest(store, '/admin/directory-sync', { authenticated: true, token: staffToken })).status).toBe(403);
  expect((await mountedRequest(store, candidatePath, { authenticated: true, method: 'POST', headers: { 'X-CSRF-Token': 'wrong' } })).status).toBe(403);
  store.sql.exec("CREATE TRIGGER reject_candidate_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT,'audit failed'); END");
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await mountedRequest(store, candidatePath, { authenticated: true, method: 'POST' })).status).toBe(500);
  expect(store.sql.prepare('SELECT status FROM directory_candidates').get()).toEqual({ status: 'pending' });
  store.sql.exec('DROP TRIGGER reject_candidate_audit');
  expect((await mountedRequest(store, candidatePath, { authenticated: true, method: 'POST' })).status).toBe(200);
  expect((await mountedRequest(store, '/admin/directory-sync', { authenticated: true })).body.candidates).toEqual([]);
});

it('fences a suspended directory owner without preventing statistics or releasing the successor lease', async () => {
  const { db, sync, state } = await setup();
  let fenced = false;
  state.onChannels = async () => {
    if (fenced) return;
    fenced = true;
    await db.prepare("UPDATE directory_sync_lease SET owner='successor',fence=fence+1,expires_at=unixepoch('now')+180").run();
  };
  await sync('2026-10-05T02:00:00Z', '/scheduled');
  expect(await db.prepare('SELECT COUNT(*) AS n FROM youtube_profile_state').first()).toEqual({ n: 0 });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM directory_candidates').first()).toEqual({ n: 0 });
  expect(await db.prepare('SELECT owner FROM directory_sync_lease').first()).toEqual({ owner: 'successor' });
  expect(await db.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').first()).toEqual({ n: 1 });
}, 30_000);

it('does not apply a fetched profile after the manager switches its channel URL', async () => {
  const { db, sync, state } = await setup();
  await sync();
  await db.prepare("UPDATE vtubers SET name='Current title' WHERE id=1").run();
  state.items[id('a')].snippet.title = 'Old channel changed name';
  let edited = false;
  state.onChannels = async requestUrl => {
    if (edited || !requestUrl.searchParams.get('id')?.includes(id('a'))) return;
    edited = true;
    await db.prepare('UPDATE vtubers SET youtube_url=?,channel_url=? WHERE id=1').bind(url('u'), url('u')).run();
  };
  await sync('2026-10-06T02:00:00Z');
  expect(await db.prepare('SELECT name FROM vtubers WHERE id=1').first()).toEqual({ name: 'Current title' });
  expect(await db.prepare('SELECT channel_id FROM youtube_profile_state WHERE vtuber_id=1').first()).toEqual({ channel_id: id('a') });
}, 30_000);
it('persists pagination and every unprocessed item at the request budget and resumes the old sweep before a new day', async () => {
  const {db,sync,state,network} = await setup();
  const discovered = Array.from({length:50},(_,n) => `UC${String(n).padStart(22,'0')}`);
  for (const channelId of discovered) state.items[channelId] = {id:channelId,snippet:{title:channelId,description:'Uncertain context',thumbnails:{}},statistics:{hiddenSubscriberCount:true}};
  state.searchPage = requestUrl => {
    if (requestUrl.searchParams.get('q') !== 'Thai VTuber' || requestUrl.searchParams.get('type') !== 'channel') return {items:[]};
    const page = Number(requestUrl.searchParams.get('pageToken') || 0);
    return {items:discovered.slice(page*10,page*10+10).map(channelId => ({id:{channelId}})),...(page<4 && {nextPageToken:String(page+1)})};
  };
  const first = await sync();
  expect(first).toMatchObject({status:'partial',channelsAdded:0,sweep:{day:'2026-10-05',completed:false,queryIndex:0,remainingItems:5}});
  expect(network.mock.calls.length).toBe(40);
  const checkpoint = await db.prepare('SELECT * FROM directory_search_checkpoint').first();
  expect(JSON.parse(checkpoint.items_json).map(item => item.id.channelId)).toEqual(discovered.slice(35,40));
  network.mockClear();
  const second = await sync('2026-10-05T17:00:00Z');
  expect(second.sweep.day).toBe('2026-10-05');
  expect(network.mock.calls.length).toBeLessThanOrEqual(40);
  expect(await db.prepare('SELECT COUNT(*) AS n FROM directory_candidates').first()).toEqual({n:50});
  expect(await db.prepare('SELECT COUNT(*) AS n FROM vtubers').first()).toEqual({n:1});
  expect((await db.prepare('SELECT day FROM directory_sync_runs').all()).results).toEqual([{day:'2026-10-05'}]);
  if (!second.sweep.completed) await sync('2026-10-05T18:00:00Z');
  expect((await db.prepare('SELECT completed FROM directory_search_checkpoint').first()).completed).toBe(1);
  await sync('2026-10-05T19:00:00Z');
  expect((await db.prepare('SELECT day FROM directory_search_checkpoint').first()).day).toBe('2026-10-06');
},30_000);

it('uses nextPageToken despite a short page, extracts video channel identity and retains profile evidence', async () => {
  const {db,sync,state,network} = await setup({existing:false});
  state.searchPage = requestUrl => {
    const type=requestUrl.searchParams.get('type');
    if (requestUrl.searchParams.get('q') !== 'Thai VTuber') return {items:[]};
    if (type==='video') return {items:[{id:{videoId:'abcdefghijk'},snippet:{channelId:id('u'),channelTitle:'Hint'}}]};
    return requestUrl.searchParams.has('pageToken') ? {items:[{id:{channelId:id('i')}}]} : {items:[],nextPageToken:'next-short-page'};
  };
  expect(await sync()).toMatchObject({status:'succeeded',channelsAdded:0,candidatesNew:2,sweep:{completed:true}});
  expect(network.mock.calls.some(([request])=>new URL(request.url).searchParams.get('pageToken')==='next-short-page')).toBe(true);
  const row=await db.prepare('SELECT evidence_json,status FROM directory_candidates WHERE channel_id=?').bind(id('u')).first();
  expect(row.status).toBe('pending');
  expect(JSON.parse(row.evidence_json)).toContainEqual({kind:'search-hint',query:'Thai VTuber',type:'video',source:'https://www.youtube.com/watch?v=abcdefghijk'});
  expect(JSON.parse(row.evidence_json)).toContainEqual({kind:'youtube-profile',source:url('u'),description:'Games and entertainment'});
},30_000);
it('rotates existing handle profiles beyond the per-run budget and refreshes all25 without timing assumptions', async () => {
  const {db,sync,state} = await setup({existing:false});
  state.searchPage=()=>({items:[]});
  const statements=[];
  for(let n=0;n<25;n++) {
    const channelId=`UC${String(n).padStart(22,'0')}`;
    const handle=`@creator-${n}`;
    state.handleItems[handle]=channelId;
    state.items[channelId]={id:channelId,snippet:{title:`Refreshed ${n}`,description:'Source',thumbnails:{}},statistics:{subscriberCount:'0',viewCount:'0',videoCount:'0'}};
    statements.push(db.prepare("INSERT INTO vtubers(name,slug,youtube_url,channel_url) VALUES ('',?,?,?)").bind(`creator-${n}`,`https://www.youtube.com/${handle}`,`https://www.youtube.com/${handle}`));
  }
  await db.batch(statements);
  expect(await sync()).toMatchObject({status:'partial',profilesChecked:10});
  expect((await db.prepare('SELECT last_vtuber_id FROM directory_profile_cursor').first()).last_vtuber_id).toBe(10);
  expect(await sync()).toMatchObject({status:'partial',profilesChecked:10});
  await sync();
  expect(await db.prepare("SELECT COUNT(*) AS n FROM vtubers WHERE name LIKE 'Refreshed %'").first()).toEqual({n:25});
  expect(await db.prepare('SELECT name FROM vtubers WHERE id=25').first()).toEqual({name:'Refreshed 24'});
},30_000);

it('refreshes canonical channel1001 on a later invocation instead of permanently repeating the first1000', async () => {
  const store=backendDatabase();stores.push(store);
  store.sql.exec("UPDATE settings SET setting_value='true' WHERE setting_key='directory_sync_enabled'");
  const channelItems=new Map();
  const insert=store.sql.prepare('INSERT INTO vtubers(id,name,slug,youtube_url,channel_url) VALUES (?,\'\',?,?,?)');
  for(let n=1;n<=1001;n++) {
    const channelId=`UC${String(n).padStart(22,'0')}`;
    const reference=`https://www.youtube.com/channel/${channelId}`;
    insert.run(n,`creator-${n}`,reference,reference);
    channelItems.set(channelId,{id:channelId,snippet:{title:`Refreshed ${n}`,description:'Source',thumbnails:{}},statistics:{subscriberCount:'0',viewCount:'0',videoCount:'0'}});
  }
  vi.stubGlobal('fetch',vi.fn(async input=>{
    const requestUrl=new URL(input);
    return Response.json({items:requestUrl.pathname.endsWith('/search')?[]:requestUrl.searchParams.get('id').split(',').map(channelId=>channelItems.get(channelId))});
  }));
  const env={DB:store.db,YOUTUBE_API_KEY:'synthetic-only'};
  expect(await syncSQLiteDirectory(env,{scheduledTime:Date.parse('2026-10-05T02:00:00Z')})).toMatchObject({status:'partial',profilesChecked:1000});
  expect(store.sql.prepare('SELECT name FROM vtubers WHERE id=1001').get().name).toBe('');
  expect(store.sql.prepare('SELECT last_vtuber_id FROM directory_profile_cursor').get().last_vtuber_id).toBe(1000);
  const firstCalls=globalThis.fetch.mock.calls.length;
  await syncSQLiteDirectory(env,{scheduledTime:Date.parse('2026-10-05T03:00:00Z')});
  expect(new URL(globalThis.fetch.mock.calls[firstCalls][0]).searchParams.get('id').split(',')[0]).toBe(`UC${String(1001).padStart(22,'0')}`);
  expect(store.sql.prepare('SELECT name FROM vtubers WHERE id=1001').get().name).toBe('Refreshed 1001');
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers WHERE name<>\'\'').get().n).toBe(1001);
},30_000);
