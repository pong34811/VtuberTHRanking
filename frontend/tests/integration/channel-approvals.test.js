import { afterEach, expect, it, vi } from 'vitest';
import { backendDatabase, mountedRequest, seedChannel, seedUser, staffToken } from '../helpers/backend-sqlite.js';
const id = `UC${'z'.repeat(22)}`;
const url = `https://www.youtube.com/channel/${id}`;
const stores = [];
const review = { name: 'Reviewed creator', slug: 'reviewed', affiliation: 'indie', bio: 'Editorial bio', notes: 'Reviewed notes', debut_date: '2026-10-01' };
const request = (store, path, payload, extra = {}) => mountedRequest(store, `/admin${path}`, { authenticated: true, ...(payload !== undefined && { method: 'POST', payload }), env: { YOUTUBE_API_KEY: 'fixture' }, ...extra });
function setup(statistics = { subscriberCount: '0',viewCount: '0',videoCount: '0' }) {
  const store = backendDatabase(); stores.push(store); seedUser(store);
  const item = { id, snippet: { title: 'Thai VTuber debut?', description: 'An ambiguous creator, awaiting review', customUrl: '@creator', thumbnails: {} },statistics };
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [item] })));
  return { store, item };
}
afterEach(() => { stores.splice(0).forEach(store => store.close()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('queues manual URL, handle, ID and channel form imports without public leaks and searches with bounded pagination', async () => {
  const { store } = setup();
  for (const input of [url,'@creator',id]) expect((await request(store,'/directory-candidates',{input})).status).toBe(202);
  expect((await request(store,'/youtube/import',{input:'@creator'})).body.queued).toBe(true);
  expect((await request(store,'/vtubers',{...review,channel_url:url})).status).toBe(202);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM directory_candidates').get().n).toBe(1);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(0);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
  expect((await mountedRequest(store,'/directory/')).body.total).toBe(0);
  expect((await mountedRequest(store,'/vtubers/reviewed/')).status).toBe(404);
  const list = await request(store,'/directory-candidates?q=Thai&limit=1&offset=0');
  expect(list.body).toMatchObject({total:1,limit:1,offset:0});
  expect(JSON.parse(list.body.results[0].profile_json)).toMatchObject({ name:'Thai VTuber debut?' });
  expect(JSON.parse(list.body.results[0].review_json)).toMatchObject(review);
  expect((await request(store,'/directory-candidates?limit=101')).status).toBe(400);
  expect((await request(store,'/directory-candidates?q=no-match')).body.total).toBe(0);
});
it.each([
  [{hiddenSubscriberCount:true},false],
  [{subscriberCount:'bad',viewCount:'0',videoCount:'0'},false],
  [{subscriberCount:'0',viewCount:'0',videoCount:'0'},true],
])('approves reviewed metadata with statistics %j (snapshot %s)', async (stats, snapshot) => {
  const {store} = setup(stats);
  await request(store,'/directory-candidates',{input:id});
  const result = await request(store,`/directory-candidates/${id}/approve`,review);
  expect(result.status).toBe(201); expect(result.body.snapshot).toBe(snapshot);
  expect(store.sql.prepare('SELECT name,slug,bio,notes,debut_date,affiliation,youtube_url FROM vtubers').get()).toMatchObject({...review,youtube_url:url});
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(Number(snapshot));
  if (snapshot) expect(store.sql.prepare('SELECT followers,total_views,video_count FROM stats_snapshots').get()).toEqual({followers:0,total_views:0,video_count:0});
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(409);
  expect((await request(store,`/directory-candidates/${id}/ignore`,{})).status).toBe(409);
  expect((await mountedRequest(store,'/directory/')).body.total).toBe(1);
});
it('requires explicit affiliation and valid agency selection, locks identity and leaves unavailable profiles pending', async () => {
  const {store,item} = setup(); await request(store,'/directory-candidates',{input:id});
  for (const input of [{name:'Name',slug:'name'},{...review,affiliation:'agency',agency_id:99},{...review,youtube_url:url+'different'},{...review,platform:'twitch'}]) {
    expect((await request(store,`/directory-candidates/${id}/approve`,input)).status).toBe(400);
  }
  item.snippet.title = '';
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(502);
  expect(store.sql.prepare('SELECT status FROM directory_candidates').get().status).toBe('pending');
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(0);
});
it('rolls back approval including queue status, snapshot and baseline on audit failure, then retries', async () => {
  const {store} = setup(); await request(store,'/directory-candidates',{input:id});
  store.control.fail = sql => /INSERT INTO audit_logs/.test(sql);
  vi.spyOn(console,'error').mockImplementation(() => {});
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(500);
  expect(store.sql.prepare('SELECT status FROM directory_candidates').get().status).toBe('pending');
  for (const table of ['vtubers','stats_snapshots','youtube_profile_state']) expect(store.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n).toBe(0);
  store.control.fail = null;
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(201);
});
it('rechecks pending status and identity inside the batch when a concurrent decision or registration wins', async () => {
  for (const mutation of [
    store => store.sql.prepare("UPDATE directory_candidates SET status='ignored'").run(),
    store => {seedChannel(store);store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=? WHERE id=1').run(url,url);},
  ]) {
    const {store} = setup();await request(store,'/directory-candidates',{input:id});
    store.control.beforeBatch = () => {store.control.beforeBatch=null;mutation(store);};
    expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(409);
    expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
    expect(store.sql.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='candidate.approve'").get().n).toBe(0);
  }
});
it('deduplicates legacy handle identities without a source baseline and honors reviewed tombstones', async () => {
  const {store} = setup();seedChannel(store);
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run('https://www.youtube.com/@creator','https://www.youtube.com/@creator');
  expect((await request(store,'/directory-candidates',{input:id})).status).toBe(409);
  store.sql.exec('DELETE FROM vtubers');
  await request(store,'/directory-candidates',{input:id});
  await request(store,`/directory-candidates/${id}/ignore`,{});
  expect((await request(store,'/youtube/import',{input:id})).status).toBe(409);
  expect((await request(store,`/directory-candidates/UC${'a'.repeat(22)}/ignore`,{})).status).toBe(404);
});
it('enforces manager, authentication and CSRF on review and queue routes', async () => {
  const {store} = setup();seedUser(store,{id:'staff',role:'staff',token:staffToken});
  for (const [path,payload] of [['/directory-candidates', {input:id}],[`/directory-candidates/${id}/approve`,review],[`/directory-candidates/${id}/ignore`,{}]]) {
    expect((await request(store,path,payload,{token:staffToken})).status).toBe(403);
    expect((await request(store,path,payload,{authenticated:false})).status).toBe(401);
    expect((await request(store,path,payload,{headers:{'X-CSRF-Token':'invalid'}})).status).toBe(403);
  }
  expect((await request(store,'/directory-candidates',undefined,{token:staffToken})).status).toBe(403);
});
it('blocks changing an existing YouTube identity, while allowing equivalent URL normalization and metadata saves', async () => {
  const {store} = setup();seedChannel(store);
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run(url,url);
  const put = data => request(store,'/vtubers/1',data,{method:'PUT'});
  const same = {...review,youtube_url:url,channel_url:url};
  expect((await put(same)).status).toBe(200);
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect((await put({...same,youtube_url:`https://www.youtube.com/channel/UC${'y'.repeat(22)}`})).status).toBe(409);
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run('https://www.youtube.com/@creator','https://www.youtube.com/@creator');
  expect((await put(same)).status).toBe(200);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
});
it('does not overwrite an imported identity if its registered references change before the update transaction', async () => {
  const {store} = setup();seedChannel(store);
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run(url,url);
  const other=`https://www.youtube.com/channel/UC${'y'.repeat(22)}`;
  store.control.beforeBatch=()=>{store.control.beforeBatch=null;store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run(other,other);};
  expect((await request(store,'/youtube/import',{input:id})).status).toBe(409);
  expect(store.sql.prepare('SELECT name,youtube_url FROM vtubers').get()).toEqual({name:'Alpha',youtube_url:other});
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM stats_snapshots').get().n).toBe(0);
});
it('resolves a legacy handle when a canonical profile has no customUrl, and matches handle spelling case-insensitively', async () => {
  const {store,item} = setup();seedChannel(store);
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run('https://youtube.com/@CREATOR/','https://youtube.com/@CREATOR/');
  expect((await request(store,'/directory-candidates',{input:id})).status).toBe(409);
  delete item.snippet.customUrl;
  expect((await request(store,'/directory-candidates',{input:id})).status).toBe(409);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM directory_candidates').get().n).toBe(0);
});
it('records the selected agency on approval rather than inferring affiliation from search evidence', async () => {
  const {store} = setup();
  store.sql.prepare("INSERT INTO agencies(id,name) VALUES (7,'Reviewed agency')").run();
  await request(store,'/directory-candidates',{input:id});
  expect((await request(store,`/directory-candidates/${id}/approve`,{...review,affiliation:'agency',agency_id:7,agency_name:'Untrusted name'})).status).toBe(201);
  expect(store.sql.prepare('SELECT affiliation,agency_id,agency_name FROM vtubers').get()).toEqual({affiliation:'agency',agency_id:7,agency_name:'Reviewed agency'});
});
it.each([
  suffix => `https://www.youtube.com/channel/${id}/${suffix}`,
  suffix => `http://m.youtube.com/channel/${id}${suffix}`,
  suffix => `HTTPS://YOUTUBE.COM:443/channel/${id}/${suffix}`,
  suffix => `https://www.youtube.com/@%63reator/${suffix}`,
])('deduplicates accepted URL query/fragment forms before queue/import and inside the approval transaction', async variant => {
  const {store} = setup();
  await request(store,'/directory-candidates',{input:id});
  seedChannel(store);
  const reference=variant('?view=creator#about');
  store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run(reference,reference);
  expect((await request(store,'/directory-candidates',{input:id})).status).toBe(409);
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(409);
  expect((await request(store,'/youtube/import',{input:id})).body).toMatchObject({id:1,updated:true});
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(1);
  store.sql.exec('DELETE FROM vtubers');
  store.control.beforeBatch=()=>{
    store.control.beforeBatch=null;seedChannel(store);
    store.sql.prepare('UPDATE vtubers SET youtube_url=?,channel_url=?').run(reference,reference);
  };
  expect((await request(store,`/directory-candidates/${id}/approve`,review)).status).toBe(409);
  expect(store.sql.prepare('SELECT COUNT(*) AS n FROM vtubers').get().n).toBe(1);
  expect(store.sql.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action='candidate.approve'").get().n).toBe(0);
});

it.each(['.','..','%2e','.%2E','%2e%2e','%','%GG','%FF'])('rejects ambiguous dot or malformed path segment %s at queue/import boundary without SQL writes', async segment => {
  const {store} = setup();
  const input=`https://www.youtube.com/channel/${segment}/${id}`;
  for(const path of ['/directory-candidates','/youtube/import']) {
    expect((await request(store,path,{input})).status).toBe(400);
  }
  expect(globalThis.fetch).not.toHaveBeenCalled();
  for(const table of ['directory_candidates','vtubers','stats_snapshots','audit_logs']) expect(store.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n).toBe(0);
});
