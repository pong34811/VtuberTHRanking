# Discovery Homepage and Stats Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish three metadata-driven discovery layouts at `/`, move the current leaderboard experience to `/stats`, and retain manager-controlled template publishing.

**Architecture:** Add a bounded metadata directory resource alongside the existing public API. Extract the statistics page, build an independently usable discovery renderer, then switch the public Home and Admin preview to the new configuration contract together. The directory renderer consumes profile metadata; Stats continues consuming summary and ranking resources.

**Tech Stack:** Existing React 19, React Router 7, Vite 8, Hono, Cloudflare Pages Functions/D1, Vitest, Testing Library, and Cypress. No new dependencies or migrations. Package runtime floor remains `^20.19.0 || >=22.12.0`; the current local Node is 24.11.1.

**Spec:** [Approved design](../specs/2026-09-24-discovery-home-and-stats-design.md)

**Status:** Ready for user review; implementation has not started.

## Global Constraints

- “Homepage curation must not depend on follower counts, view counts, rank, rank changes, or other performance metrics.”
- ““มาใหม่” means recently added to this directory, based on `vtubers.created_at`; it does not mean recently debuted.”
- “Keep creator names, avatars, categories, and affiliations sourced from profile records. Do not invent activity, recommendations, counts, or social proof.”
- “Preserve the existing manager-only template selector, draft preview, save flow, setting persistence, and audit behavior.”
- “No new data provider or ongoing paid service is part of this change.”
- “Use stable IDs `search-first`, `category-first`, and `newest-first`.”
- “Category counts are grouped over all active profile records, independent of pagination, and labeled as directory counts.”
- “Admin writes accept only the new IDs.”
- “Remove `homepage_template` from the public `/summary/` response.”
- “Keep ranking data, formulas, snapshot collection, and Admin permissions as they are.”

## Review Focus

1. Configuration fails while directory data succeeds: Home still works using `search-first` (Task 5 component case).
2. Old stored template IDs versus old IDs submitted for publication: reads fall back, writes reject without changes (Task 5 integration cases).
3. Equal/missing/invalid creation dates and a page smaller than its category population: ordering stays deterministic, unavailable dates stay unlabeled, counts remain global (Tasks 1 and 4).
4. Encoded Thai search terms, invalid URL filters, back/forward navigation, and clearing filters: displayed controls and API parameters agree without restoring stale query values (Task 3).
5. Rapid preview selection, a save resolving after another selection, and submitting the preview search: stale responses do not overwrite the current draft or navigate out of Admin (Tasks 4 and 5).

## File ownership and interfaces

| Files | Responsibility |
| --- | --- |
| `shared/directory.js` | Stable category and affiliation enums shared by directory validation and discovery links. |
| `frontend/server/pagination.js` | Existing bounded integer parser, extracted without changing ranking pagination. |
| `frontend/server/directory.js` | Metadata-only Hono directory resource. |
| `frontend/server/public.js` | Mount directory router; expose public template configuration; remove configuration from summary. |
| `frontend/src/api/client.js` | Axios `directoryAPI.getList(params)` and `homepageConfigAPI.get()` wrappers. |
| `frontend/src/pages/StatsPage.jsx`, `stats.css` | Existing ranking experience and its styles. |
| `frontend/src/App.jsx`, `components/Navbar.jsx`, `index.css` | Stats route and four usable navigation destinations. |
| `frontend/src/pages/searchParams.js`, `SearchPage.jsx` | Safe metadata links and URL-prefilled search controls. |
| `frontend/src/pages/discovery/useDiscoveryData.js` | Directory requests, category samples, loading/retry and stale-response handling. |
| `frontend/src/pages/discovery/CreatorCard.jsx` | Profile card, avatar fallback, truthful optional directory-added date. |
| `frontend/src/pages/discovery/DiscoveryHome.jsx`, `discovery.css` | Three distinct directory layouts and preview containment. |
| `frontend/src/pages/HomePage.jsx` | Published-template loading or Admin template override; delegates rendering. |
| `shared/homepage-templates.js`, `frontend/src/pages/homepageTemplates.js` | New accepted IDs, fallback, labels and descriptions. |
| `frontend/src/admin/tabs/HomepageTemplateTab.jsx`, `admin.css` | Existing draft/save workflow with new thumbnails and preview. |

All file paths below are relative to the repository root. Run npm commands from `frontend`. Keep the work local until separately instructed to publish/deploy. Do not invoke the updater or modify production data during verification.

## Settled API and presentation decisions

Public API paths in this plan are relative to `/api/v1`.

```js
// GET /directory/?q=&category=&affiliation=&sort=name&limit=12&offset=0
// DirectoryCreator fields: id, name, slug, avatar, category, affiliation, created_at.
// Missing nullable metadata is represented as null; no metric fields are present.
{
  total: 3,              // active rows matching q/category/affiliation
  count: 1,              // results.length
  limit: 1,
  offset: 0,
  results: [{ id: 1, name: 'Aiko', slug: 'aiko', avatar: '', category: 'gaming', affiliation: 'indie', created_at: '2026-09-20 00:00:00' }],
  category_counts: [{ category: 'gaming', count: 2 }, { category: 'singing', count: 1 }] // all active rows, unfiltered
}

// GET /homepage-config/
({ template: 'search-first' })

// Existing Admin GET/PUT /admin/settings/homepage-template keeps its field name.
({ homepage_template: 'search-first' })
```

- Directory defaults: `limit=12`, maximum `100`, minimum `1`, `offset=0`, sort `name`. Reuse existing integer fallback/clamp behavior. Empty filters mean no filter; unknown nonempty category/affiliation returns 400. Unknown sort uses `name`. All query values are bound parameters.
- Name sort: `v.name COLLATE NOCASE ASC, v.id ASC`. Newest sort: valid `datetime(v.created_at)` first, then datetime descending, name and ID ascending. Missing, unparseable or impossible calendar dates sort last; validate the date prefix before using SQLite's normalized timestamp.
- Category counts cover all active profiles, ignoring result filters and pagination. Do not infer them from returned cards.
- Search and newest templates request 12 cards. Category template first requests counts with `limit=1`, then requests up to three alphabetical creators for each nonempty known category (at most seven category requests). This avoids selecting category samples from one truncated alphabetical page.
- No random, metric-based or personalized selection. Alphabetical cards are described as directory entries, not recommendations.
- The frontend normalizes SQLite UTC timestamps before formatting in `Asia/Bangkok`. Invalid dates produce no date label. The API uses `datetime()` to sort mixed SQLite/ISO timestamp formats.

---

### Task 1: Add the metadata directory resource

**Files:**
- Create: `shared/directory.js`
- Create: `frontend/server/pagination.js`
- Create: `frontend/server/directory.js`
- Modify: `frontend/server/public.js`
- Modify: `frontend/src/api/client.js`
- Create: `frontend/tests/integration/directory-api.test.js`
- Modify: `docs/API_SPEC.md`

**Interfaces:**
- Consumes: `c.env.DB` with D1 `prepare().bind().first()/all()` methods; existing `createD1Stub(responses)` test helper.
- Produces: `DIRECTORY_CATEGORIES`, `DIRECTORY_AFFILIATIONS`; `pageInteger(value, fallback, minimum, maximum)`; default Hono directory router; `directoryAPI.getList(params)` returning an Axios response with the contract above.

- [ ] **Add focused endpoint contract tests.** Use the existing FIFO D1 helper to assert exact response fields, validation before database access, bounded values and absence of metric queries. It does not execute SQL; use the real SQLite check below for ordering/filtering.

```js
import { describe, expect, it } from 'vitest';
import publicApi from '../../server/public.js';
import { createD1Stub } from '../helpers/d1.js';

async function request(path, responses = []) {
  const { db, calls } = createD1Stub(responses);
  const response = await publicApi.fetch(new Request('https://example.com' + path), { DB: db });
  return { response, calls };
}

it('returns only directory fields and global category counts', async () => {
  const creator = { id: 1, name: 'Aiko', slug: 'aiko', avatar: '', category: 'gaming', affiliation: 'indie', created_at: '2026-09-01 00:00:00' };
  const { response, calls } = await request('/directory/?limit=1', [
    { total: 3 },
    { results: [{ ...creator, followers: 999, notes: 'private' }] },
    { results: [{ category: 'gaming', count: 3 }] },
  ]);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ total: 3, count: 1, limit: 1, offset: 0, results: [creator], category_counts: [{ category: 'gaming', count: 3 }] });
  expect(calls.map(call => call.sql).join(' ')).not.toMatch(/stats_snapshots|rankings|followers|rank_change/);
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
  const { response } = await request('/directory/?' + query);
  expect(await response.json()).toMatchObject({ limit, offset, count: 0, results: [] });
});
```

- [ ] **Run the new tests to capture missing-route failures.** `npm test -- tests/integration/directory-api.test.js`; expected failures are 404/contract mismatches before implementation.
- [ ] **Extract the existing parser and add the directory handler.** Move the unchanged `pageInteger` function from `public.js` into `pagination.js` and import it in both routers. Define the shared enums and resource as follows; imports refer to `hono`, `./pagination.js`, and `../../shared/directory.js`.

```js
// shared/directory.js
export const DIRECTORY_CATEGORIES = Object.freeze(['gaming', 'singing', 'chatting', 'art', 'asmr', 'education', 'other']);
export const DIRECTORY_AFFILIATIONS = Object.freeze(['indie', 'agency']);

// directory.js handler body, registered at router.get('/')
const db = c.env.DB;
if (!db) return c.json({ error: 'DB not available' }, 500);
const q = (c.req.query('q') || '').trim();
const category = c.req.query('category') || '';
const affiliation = c.req.query('affiliation') || '';
if ((category && !DIRECTORY_CATEGORIES.includes(category)) || (affiliation && !DIRECTORY_AFFILIATIONS.includes(affiliation))) {
  return c.json({ error: true, status: 400, message: 'Invalid directory filter' }, 400);
}
const limit = pageInteger(c.req.query('limit'), 12, 1, 100);
const offset = pageInteger(c.req.query('offset'), 0, 0);
const clauses = ['v.is_active = 1'];
const values = [];
if (q) { clauses.push('v.name LIKE ?'); values.push('%' + q + '%'); }
if (category) { clauses.push('v.category = ?'); values.push(category); }
if (affiliation) { clauses.push('v.affiliation = ?'); values.push(affiliation); }
const where = 'WHERE ' + clauses.join(' AND ');
const addedAt = "CASE WHEN date(substr(v.created_at,1,10), '+0 days') = substr(v.created_at,1,10) AND substr(v.created_at,12,2) BETWEEN '00' AND '23' THEN datetime(v.created_at) END";
const order = c.req.query('sort') === 'created_at_desc'
  ? 'CASE WHEN (' + addedAt + ') IS NULL THEN 1 ELSE 0 END ASC, (' + addedAt + ') DESC, v.name COLLATE NOCASE ASC, v.id ASC'
  : 'v.name COLLATE NOCASE ASC, v.id ASC';
const totalRow = await db.prepare('SELECT COUNT(*) AS total FROM vtubers v ' + where).bind(...values).first();
const rows = await db.prepare('SELECT v.id, v.name, v.slug, v.avatar, v.category, v.affiliation, v.created_at FROM vtubers v ' + where + ' ORDER BY ' + order + ' LIMIT ? OFFSET ?').bind(...values, limit, offset).all();
const facets = await db.prepare('SELECT category, COUNT(*) AS count FROM vtubers WHERE is_active = 1 GROUP BY category ORDER BY category').all();
const fields = ['id', 'name', 'slug', 'avatar', 'category', 'affiliation', 'created_at'];
const results = rows.results.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? null])));
return c.json({ total: totalRow?.total || 0, count: results.length, limit, offset, results, category_counts: facets.results });
```

Mount with `api.route('/directory', directoryApi)`. Add `export const directoryAPI = { getList: (params = {}) => client.get('/directory/', { params }) }` to the existing Axios client. Document the complete response and filter semantics in `docs/API_SPEC.md`.

- [ ] **Run actual SQL behavior against an in-memory database.** On the current Node 24 environment, pipe this script to `node --input-type=module` from `frontend` using a PowerShell literal here-string. This is a local verification step; do not add a `node:sqlite` dependency/import to application code or change the project's runtime floor.

```js
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import publicApi from './server/public.js';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec("CREATE TABLE vtubers(id INTEGER PRIMARY KEY,name TEXT,slug TEXT,avatar TEXT,category TEXT,affiliation TEXT,created_at TEXT,is_active INTEGER)");
const insert = sqlite.prepare('INSERT INTO vtubers VALUES(?,?,?,?,?,?,?,?)');
[
  [1,'Biko','biko','','gaming','indie','2026-09-20 00:00:00',1],
  [2,'Aiko','aiko','','singing','agency','2026-09-20T00:00:00Z',1],
  [3,'Older','older','','gaming','indie','2026-01-01 00:00:00',1],
  [4,'Missing','missing','','gaming','indie',null,1],
  [5,'Invalid','invalid','','art','indie','invalid',1],
  [6,'Hidden','hidden','','gaming','indie','2026-09-24 00:00:00',0],
  [7,'Overflow','overflow','','art','indie','2026-02-30 00:00:00',1],
].forEach(row => insert.run(...row));
const db = { prepare(sql) {
  const statement = sqlite.prepare(sql);
  let args = [];
  const wrapper = {
    bind(...values) { args = values; return wrapper; },
    async first() { return statement.get(...args) ?? null; },
    async all() { return { results: statement.all(...args) }; },
  };
  return wrapper;
} };
const get = async query => {
  const response = await publicApi.fetch(new Request('https://example.com/directory/?' + query), { DB: db });
  assert.equal(response.status, 200);
  return response.json();
};
const newest = await get('sort=created_at_desc&limit=100');
assert.deepEqual(newest.results.map(row => row.id), [2,1,3,5,4,7]);
const page = await get('category=gaming&affiliation=indie&limit=1&offset=1');
assert.equal(page.total, 3);
assert.equal(page.count, 1);
assert.equal(page.category_counts.find(row => row.category === 'gaming').count, 3);
assert.equal(page.category_counts.find(row => row.category === 'singing').count, 1);
assert.deepEqual((await get('q=Aiko')).results.map(row => row.id), [2]);
assert.equal((await get('offset=100')).count, 0);
assert.equal((await get('q=NoMatch')).total, 0);
assert.deepEqual((await get('sort=unknown')).results.map(row => row.id), [2,1,5,4,3,7]);
sqlite.close();
```

- [ ] **Run focused regressions and commit.** `npm test -- tests/integration/directory-api.test.js tests/integration/public-api.test.js`; expected PASS, including existing ranking pagination and follower search cases. Commit this task's files as `feat: add metadata directory API`.

### Task 2: Extract the stats route and preserve its presentation

**Files:**
- Create: `frontend/src/pages/StatsPage.jsx`
- Move: `frontend/src/pages/home.css` to `frontend/src/pages/stats.css`
- Modify: `frontend/src/pages/HomePage.jsx` (temporary stylesheet import only)
- Modify: `frontend/src/App.jsx`, `frontend/src/components/Navbar.jsx`, `frontend/src/index.css`
- Create: `frontend/tests/unit/components/stats-page.test.jsx`
- Move: `frontend/cypress/e2e/public/home.cy.js` to `frontend/cypress/e2e/public/stats.cy.js`

**Interfaces:**
- Consumes: `rankingsAPI.getList({period, category, limit: 50})`, `summaryAPI.get()`, existing selectors, feedback and leaderboard components.
- Produces: default `StatsPage`; `/stats` route; existing ranking summary, table, methodology, loading/retry and metric/period behavior.

- [ ] **Write focused StatsPage behavior tests using existing API mocks.** Seed an Aiko row and summary choices from the existing fixtures. Exercise the actual metric controls and independent failure handling:

```jsx
it('keeps ranking controls usable when the summary fails', async () => {
  summaryAPI.get.mockRejectedValue(new Error('summary unavailable'));
  rankingsAPI.getList.mockResolvedValue({ data: { results: [], total: 0 } });
  render(<MemoryRouter><StatsPage /></MemoryRouter>);
  expect(await screen.findByText('โหลดข้อมูลภาพรวมไม่สำเร็จ')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ยอดวิว' }));
  await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', limit: 50 }));
  fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
  await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'alltime', category: 'views', limit: 50 }));
});

it('retries rankings without refetching the successful summary', async () => {
  summaryAPI.get.mockResolvedValue({ data: { total_vtubers: 2, latest_update: '2026-09-01T00:00:00Z' } });
  rankingsAPI.getList.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ data: { results: [], total: 0 } });
  render(<MemoryRouter><StatsPage /></MemoryRouter>);
  await screen.findByText('โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง');
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledTimes(2));
  expect(summaryAPI.get).toHaveBeenCalledTimes(1);
  expect(screen.getByText('วิธีจัดอันดับ')).toBeInTheDocument();
});
```

- [ ] **Run the new test file and observe the missing-page failure.** `npm test -- tests/unit/components/stats-page.test.jsx`.
- [ ] **Extract the existing page's statistics behavior.** Copy the current states/effects and `summarySection`, `methodSection`, `rankingsSection` into `StatsPage.jsx`. Preserve selector defaults, exact methodology, source/snapshot labels, table count and rank-change legend. Remove template selection and decorative hero from this page. Its final JSX is:

```jsx
return (
  <div className="homepage stats-page">
    <header className="home-section-heading">
      <div><p className="home-section-kicker">VTUBER THAILAND</p><h1>สถิติ VTuber ไทย</h1><p>สำรวจอันดับจากข้อมูล YouTube ที่บันทึกไว้ในระบบ</p></div>
      <Link to="/">ค้นพบ VTuber</Link>
    </header>
    {summarySection}
    {methodSection}
    {rankingsSection}
  </div>
);
```

- [ ] **Move existing table styles and wire routes/navigation.** Rename `home.css` to `stats.css`; update both StatsPage and the still-existing HomePage imports so this intermediate commit works. Register the lazy page and use four destinations:

```jsx
const StatsPage = lazy(() => import('./pages/StatsPage'));
// Within the public Layout routes:
<Route path="stats" element={<StatsPage />} />
// Navbar item data:
[['/', 'หน้าแรก', '01'], ['/stats', 'สถิติ', '02'], ['/search', 'ค้นหา', '03'], ['/compare', 'เปรียบเทียบ', '04']]
```

Keep the existing active link semantics and skip link. Adjust mobile nav rules to fit four labels without document overflow; hide decorative numeric indexes at narrow widths if needed. Retain theme token and focus styles.

- [ ] **Move the existing Cypress ranking journey.** Change its visit to `/stats`, its h1 assertion to `สถิติ VTuber ไทย`, and retain the summary, methodology, metric request and channel assertions. Add navigation coverage:

```js
cy.get('nav[aria-label="เมนูหลัก"]').contains('a', 'สถิติ').click();
cy.location('pathname').should('eq', '/stats');
cy.viewport(390, 844);
cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
```

- [ ] **Verify and commit.** Run `npm test -- tests/unit/components/stats-page.test.jsx tests/unit/components/homepage-templates.test.jsx`, then `npm run test:e2e -- --spec "cypress/e2e/public/stats.cy.js"`. Commit as `feat: move statistics experience to dedicated route`.

### Task 3: Support homepage links into existing search filters

**Files:**
- Create: `frontend/src/pages/searchParams.js`
- Modify: `frontend/src/pages/SearchPage.jsx`
- Modify: `frontend/tests/unit/components/search-page.test.jsx`
- Modify: `frontend/cypress/e2e/public/search.cy.js`

**Interfaces:**
- Consumes: shared directory enums from Task 1; React Router location/search parameters.
- Produces: `readDirectorySearch(search): {q, category, affiliation}` and `directorySearchHref(filters): string`; Search controls synchronized when the location query changes.

- [ ] **Add regression cases before changing URL handling.** Keep existing follower range/sort tests. Add these URL handoff cases and a router navigation harness that has buttons for `navigate('/search?q=Biko&category=singing')` and `navigate(-1)`:

```jsx
it('prefills encoded Thai search and clears URL filters permanently', async () => {
  render(<MemoryRouter initialEntries={['/search?q=%E0%B8%A1%E0%B8%B4%E0%B8%81%E0%B8%B8&category=gaming&affiliation=indie']}><SearchPage /></MemoryRouter>);
  expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('มิกุ');
  expect(screen.getByLabelText('ประเภทเนื้อหา')).toHaveValue('gaming');
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'มิกุ', category: 'gaming', affiliation: 'indie' }));
  fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: '', category: '', affiliation: '' }));
  expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('');
});

it('ignores unsupported metadata query filters', async () => {
  render(<MemoryRouter initialEntries={['/search?category=unknown&affiliation=unknown']}><SearchPage /></MemoryRouter>);
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: '', category: '', affiliation: '' }));
});
```

Add this navigation harness and case to exercise changes while SearchPage remains mounted. Import `useNavigate` from React Router:

```jsx
function SearchNavigation() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate('/search?q=Biko&category=singing')}>อีกคำค้น</button><button onClick={() => navigate(-1)}>ย้อนกลับ</button><SearchPage /></>;
}
it('updates filters for navigation and restores them on back', async () => {
  render(<MemoryRouter initialEntries={['/search?q=Aiko&category=gaming']}><SearchNavigation /></MemoryRouter>);
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', affiliation: '' }));
  fireEvent.click(screen.getByRole('button', { name: 'อีกคำค้น' }));
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Biko', category: 'singing', affiliation: '' }));
  expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('Biko');
  fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
  await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', affiliation: '' }));
  expect(screen.getByLabelText('ประเภทเนื้อหา')).toHaveValue('gaming');
});
```

- [ ] **Run `npm test -- tests/unit/components/search-page.test.jsx` and observe URL-prefill failures.**
- [ ] **Implement the small shared URL helper.** Import the enums from `../../../shared/directory.js`:

```js
export function readDirectorySearch(search) {
  const params = new URLSearchParams(search);
  const category = params.get('category') || '';
  const affiliation = params.get('affiliation') || '';
  return {
    q: (params.get('q') || '').trim(),
    category: DIRECTORY_CATEGORIES.includes(category) ? category : '',
    affiliation: DIRECTORY_AFFILIATIONS.includes(affiliation) ? affiliation : '',
  };
}
export function directorySearchHref(filters = {}) {
  const clean = readDirectorySearch(new URLSearchParams(filters).toString());
  const params = new URLSearchParams(Object.entries(clean).filter(([, value]) => value));
  return '/search' + (params.size ? '?' + params.toString() : '');
}
```

- [ ] **Initialize and synchronize the existing Search state.** Keep follower validation, debounce, request cleanup and sort code. Use `useLocation` and `useSearchParams` and seed q/category/affiliation from `readDirectorySearch(location.search)`. Synchronize only on `location.search` changes, so local edits do not restore a stale URL value:

```jsx
useEffect(() => {
  const next = readDirectorySearch(location.search);
  setQuery(next.q);
  setCategory(next.category);
  setAffiliation(next.affiliation);
}, [location.search]);
// Add to the existing clearFilters function after resetting all local controls:
setSearchParams(current => {
  const next = new URLSearchParams(current);
  ['q', 'category', 'affiliation'].forEach(key => next.delete(key));
  return next;
}, { replace: true });
```

- [ ] **Verify browser handoff and commit.** Add a Cypress case that visits `/search?q=Aiko&category=gaming`, checks input/select values and the intercepted API query, clears filters and checks the URL no longer contains those keys. Run `npm test -- tests/unit/components/search-page.test.jsx tests/unit/components/public-pages.test.jsx` and the focused search Cypress spec. Commit as `feat: prefill directory search from homepage links`.

### Task 4: Build the three discovery layouts as an independent renderer

**Files:**
- Create: `frontend/src/pages/discovery/useDiscoveryData.js`
- Create: `frontend/src/pages/discovery/CreatorCard.jsx`
- Create: `frontend/src/pages/discovery/DiscoveryHome.jsx`
- Create: `frontend/src/pages/discovery/discovery.css`
- Create: `frontend/tests/unit/components/discovery-home.test.jsx`

**Interfaces:**
- Consumes: `directoryAPI.getList(params)`, `directorySearchHref(filters)`, shared enums and existing `categoryLabel`/`affiliationLabel` functions.
- Produces: `useDiscoveryData(templateId)` returning `{data, loading, error, retry}`. `data` is `{total, results, category_counts, groups}`; each group is `{category, results, error}`. Default `DiscoveryHome({templateId = 'search-first', previewMode = false})`. Default `CreatorCard({creator, showAddedDate = false})`; named `directoryAddedDate(raw)` returning `{iso,label}` or null.
- The renderer is tested directly here; the public homepage switches to it in Task 5.

- [ ] **Add behavior tests against mocked directory responses.** Mock the existing API module with `directoryAPI: {getList: vi.fn()}`. Use the standard RTL/Vitest setup and cleanup. Seed its default response in `beforeEach`; individual category and failure cases override it:

```js
const aiko = { id: 1, name: 'Aiko', slug: 'aiko', avatar: '', category: 'gaming', affiliation: 'indie', created_at: '2026-09-01 00:00:00' };
const page = { total: 1, count: 1, limit: 12, offset: 0, results: [aiko], category_counts: [{ category: 'gaming', count: 1 }] };
beforeEach(() => {
  vi.clearAllMocks();
  directoryAPI.getList.mockResolvedValue({ data: page });
});
afterEach(() => cleanup());
```

Include these concrete cases:

```jsx
it('requests each nonempty category independently of the first result page', async () => {
  directoryAPI.getList.mockImplementation(params => Promise.resolve({ data: params.category
    ? { total: 1, count: 1, results: [{ id: 2, name: 'Biko', slug: 'biko', category: params.category, affiliation: 'indie', avatar: '', created_at: null }], category_counts: [] }
    : { total: 20, count: 1, results: [], category_counts: [{ category: 'singing', count: 20 }] }
  }));
  render(<MemoryRouter><DiscoveryHome templateId="category-first" /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: /Biko/ })).toBeInTheDocument();
  expect(directoryAPI.getList).toHaveBeenCalledWith({ category: 'singing', sort: 'name', limit: 3, offset: 0 });
  expect(screen.getByRole('link', { name: /ร้องเพลง.*20/ })).toHaveAttribute('href', '/search?category=singing');
});

it('never invents a directory-added date', () => {
  expect(directoryAddedDate('invalid')).toBeNull();
  expect(directoryAddedDate(null)).toBeNull();
  expect(directoryAddedDate('2026-02-30 00:00:00')).toBeNull();
  expect(directoryAddedDate('2026-09-20 00:00:00').iso).toBe('2026-09-20T00:00:00.000Z');
});

it('contains search submit and creator links in Admin preview', async () => {
  render(<MemoryRouter initialEntries={['/admin/homepage']}><CurrentLocation /><DiscoveryHome previewMode /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: 'Aiko' } });
  fireEvent.submit(screen.getByRole('search'));
  fireEvent.click(screen.getByRole('link', { name: /Aiko/ }));
  expect(screen.getByTestId('current-location')).toHaveTextContent('/admin/homepage');
});
```

`CurrentLocation` is a test-local component returning `<output data-testid="current-location">{location.pathname + location.search}</output>` using `useLocation`. Add these request-state cases:

```jsx
it('retries a failed directory request', async () => {
  directoryAPI.getList.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ data: page });
  render(<MemoryRouter><DiscoveryHome /></MemoryRouter>);
  await screen.findByText('โหลดรายชื่อไม่สำเร็จ กรุณาลองอีกครั้ง');
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(await screen.findByRole('link', { name: /Aiko/ })).toBeInTheDocument();
});
it('keeps newer template results when an old request finishes late', async () => {
  let finishOld;
  const biko = { ...aiko, id: 2, name: 'Biko', slug: 'biko' };
  directoryAPI.getList.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ data: { ...page, results: [biko] } });
  const { rerender } = render(<MemoryRouter><DiscoveryHome templateId="search-first" /></MemoryRouter>);
  rerender(<MemoryRouter><DiscoveryHome templateId="newest-first" /></MemoryRouter>);
  await screen.findByRole('link', { name: /Biko/ });
  await act(async () => finishOld({ data: page }));
  expect(screen.queryByRole('link', { name: /Aiko/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Biko/ })).toBeInTheDocument();
});
it('shows an empty state and search link for an empty directory', async () => {
  directoryAPI.getList.mockResolvedValue({ data: { ...page, total: 0, count: 0, results: [], category_counts: [] } });
  render(<MemoryRouter><DiscoveryHome /></MemoryRouter>);
  expect(await screen.findByText('ยังไม่มีรายชื่อให้แสดง')).toBeInTheDocument();
  expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/search')).toBe(true);
});
it('falls back to an initial when a creator image fails', () => {
  const { container } = render(<MemoryRouter><CreatorCard creator={{ ...aiko, avatar: 'https://example.com/aiko.png' }} /></MemoryRouter>);
  fireEvent.error(container.querySelector('img'));
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('A')).toBeInTheDocument();
});
```

- [ ] **Run `npm test -- tests/unit/components/discovery-home.test.jsx` and capture missing-component failures.**
- [ ] **Implement independent request state with cancellation guards.** Reset displayed cards when template changes. Fetch base metadata as follows, then store category sample successes/errors independently using `Promise.allSettled`:

```js
const baseParams = { sort: templateId === 'newest-first' ? 'created_at_desc' : 'name', limit: templateId === 'category-first' ? 1 : 12, offset: 0 };
const base = (await directoryAPI.getList(baseParams)).data;
const categories = DIRECTORY_CATEGORIES.filter(category => base.category_counts.some(item => item.category === category && item.count > 0));
const settled = templateId === 'category-first'
  ? await Promise.allSettled(categories.map(category => directoryAPI.getList({ category, sort: 'name', limit: 3, offset: 0 })))
  : [];
const groups = settled.map((result, index) => ({
  category: categories[index],
  results: result.status === 'fulfilled' ? result.value.data.results : [],
  error: result.status === 'rejected' ? 'โหลดรายชื่อในหมวดหมู่นี้ไม่สำเร็จ' : '',
}));
```

Inside `useEffect`, use a local `active` flag checked before each state update and set it false during cleanup. Catch base-request failure as `โหลดรายชื่อไม่สำเร็จ กรุณาลองอีกครั้ง`; preserve accessible category counts when only a group request fails. `retry` increments a local retry counter, repeating this metadata load. Display an inline retry for a failed group; a retry may refresh the full metadata load. Never call summary, rankings or profile APIs here.

- [ ] **Build the creator card and date formatter.** Keep one profile link with avatar, creator name, category and affiliation. Use `onError` and initials for missing/failed images, and clear the failed-image state when the avatar URL changes. The name is link text; the avatar has `alt=""` to avoid duplicate announcements. Add dates only with `showAddedDate`:

```js
export function directoryAddedDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const value = raw.trim();
  const sqliteTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!sqliteTimestamp && !isoTimestamp) return null;
  const dayText = value.slice(0, 10);
  const day = new Date(dayText + 'T00:00:00Z');
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== dayText || Number(value.slice(11, 13)) > 23) return null;
  const date = new Date(sqliteTimestamp ? value.replace(' ', 'T') + 'Z' : value);
  if (Number.isNaN(date.getTime())) return null;
  return { iso: date.toISOString(), label: date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }) };
}
```

```jsx
const added = showAddedDate ? directoryAddedDate(creator.created_at) : null;
useEffect(() => setFailed(false), [creator.avatar]);
<Link className="discovery-card" to={'/profile/' + encodeURIComponent(creator.slug)}>
  {creator.avatar && !failed ? <img src={creator.avatar} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="discovery-avatar-fallback" aria-hidden="true">{(creator.name || '?').slice(0, 1)}</span>}
  <h3>{creator.name}</h3>
  <p>{categoryLabel(creator.category)} · {affiliationLabel(creator.affiliation)}</p>
  {added && <p>เพิ่มเข้ารายการ <time dateTime={added.iso}>{added.label}</time></p>}
</Link>
```

- [ ] **Implement three distinct layouts with shared controls.** Use a root `.homepage.discovery-home` with `data-template={templateId}`. Use a single h1 with titles `ค้นพบ VTuber ไทย`, `ค้นพบผ่านหมวดหมู่`, and `เพิ่มเข้ารายการล่าสุด` respectively. Search-first puts the search form, category/affiliation links, then a 12-card grid first. Category-first puts counted category tiles first, then labeled category groups of at most three cards and a “ดูทั้งหมด” link. Newest-first puts a compact explanation of directory-added dates and dated cards first, with a nearby search link. Provide `/stats` in the shared navigation.

```jsx
function containPreviewLink(event) {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
}
// Root capture blocks link activation, including keyboard-generated clicks.
<div className="homepage discovery-home" data-template={templateId} onClickCapture={previewMode ? containPreviewLink : undefined}>
  <form role="search" onSubmit={event => {
    event.preventDefault();
    if (!previewMode) navigate(directorySearchHref({ q: query }));
  }}>
    <label htmlFor={searchId}>ค้นหาชื่อ VTuber</label>
    <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} />
    <button type="submit">ค้นหา</button>
  </form>
</div>
```

Use `useId()` for `searchId`, `useState('')` for `query`, and `useNavigate()` for `navigate`. Empty search opens `/search`. Category/affiliation links use `directorySearchHref`. Render loading with `aria-busy` and a status message, base errors with retry, empty results with `ยังไม่มีรายชื่อให้แสดง` and a search link. Never show a fabricated creator or zero category counts while loading.

- [ ] **Style the directory using existing theme tokens.** Scope styles under `.discovery-home` to prevent Admin/global selector collisions. Use compact headings, real avatars, category accents, cards with visible profile links, and wrapping Thai names. Avoid fixed hero height. Use this responsive structure and extend it for the three distinct layouts:

```css
.discovery-home { min-width: 0; }
.discovery-home .discovery-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.discovery-home .discovery-card { min-width: 0; padding: 16px; border: 1px solid var(--border); border-radius: 16px; color: var(--foreground); }
.discovery-home .discovery-card h3 { overflow-wrap: anywhere; }
.discovery-home .discovery-card img, .discovery-home .discovery-avatar-fallback { width: 80px; height: 80px; object-fit: cover; border-radius: 50%; }
.discovery-home input, .discovery-home button { min-height: 44px; }
.discovery-home :is(a, button, input):focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
@media (max-width: 760px) { .discovery-home .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 370px) { .discovery-home .discovery-card { padding: 12px; } }
@media (prefers-reduced-motion: reduce) { .discovery-home * { transition: none; } }
```

The referenced tokens exist in `src/index.css` for light and dark themes. Keep a discovery action and the start of actual creator content visible at 390×844; use compact category tiles and omit large decorative art. Give the root `container-type: inline-size`; use a container query as well as the mobile rules so the Admin preview can reduce columns at narrow container widths even on a desktop viewport:

```css
.discovery-home { container-type: inline-size; }
@container (max-width: 640px) { .discovery-home .discovery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

- [ ] **Run the focused component cases and commit.** `npm test -- tests/unit/components/discovery-home.test.jsx`. Commit as `feat: add three metadata discovery layouts`.

### Task 5: Activate the discovery Home and update publishing

**Files:**
- Modify: `shared/homepage-templates.js`, `frontend/src/pages/homepageTemplates.js`
- Modify: `frontend/server/public.js`, `frontend/src/api/client.js`
- Replace implementation: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/admin/tabs/HomepageTemplateTab.jsx`, `frontend/src/admin/admin.css`
- Modify: `frontend/src/pages/stats.css` (remove now-unused old hero/template rules)
- Modify: `frontend/tests/unit/shared/homepage-templates.test.js`
- Modify: `frontend/tests/integration/homepage-template.test.js`, `frontend/tests/integration/public-api.test.js`
- Modify: `frontend/tests/unit/components/homepage-templates.test.jsx`, `frontend/tests/unit/components/homepage-template-admin.test.jsx`
- Create: `frontend/cypress/fixtures/directory.json`, `frontend/cypress/e2e/public/home.cy.js`
- Modify: `frontend/cypress/support/commands.js`, `frontend/cypress/e2e/admin/homepage-template.cy.js`
- Modify: `docs/API_SPEC.md`, `docs/PRD.md`, `docs/PROJECT_STRUCTURE.md`, `docs/superpowers/specs/2026-09-23-homepage-template-settings.md`

**Interfaces:**
- Consumes: `DiscoveryHome({templateId, previewMode})`; existing Admin `homepage_template` request/response and draft state.
- Produces: new shared accepted IDs and default, `homepageConfigAPI.get()`, public `GET /homepage-config/` returning `{template}`; public Home no longer requests summary/rankings. `HomePage({templateOverride, previewMode = false})` remains Admin-compatible.

- [ ] **Change integration expectations to the new configuration boundary.** Keep all existing manager/staff/audit cases. Replace successful old-ID publications with the new IDs; separately reject old IDs. Split public configuration expectations out of summary tests:

```js
it.each(['ranking-first', 'discovery-first', 'compact-ranking', 'unknown', null])('normalizes stored %s on public read', async value => {
  const { response } = await requestPublic('/homepage-config/', [value == null ? null : { setting_value: value }]);
  expect(await response.json()).toEqual({ template: 'search-first' });
});
it.each(['search-first', 'category-first', 'newest-first'])('publishes %s through configuration', async template => {
  const { response } = await requestPublic('/homepage-config/', [{ setting_value: template }]);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ template });
});
it.each(['ranking-first', 'discovery-first', 'compact-ranking'])('rejects an old publication ID %s', async homepage_template => {
  const { response, calls } = await requestAdmin('/settings/homepage-template', { init: jsonPut({ homepage_template }) });
  expect(response.status).toBe(400);
  expect(calls).toEqual([]);
});
it('summary reads only statistics context', async () => {
  const { response, calls } = await requestPublic('/summary/', [{ count: 3 }, { total: 1000 }, null, { recorded_at: '2026-09-01T00:00:00Z' }]);
  expect(await response.json()).not.toHaveProperty('homepage_template');
  expect(calls.some(call => /\bsettings\b/.test(call.sql))).toBe(false);
});
```

Update shared normalizer tests for all three new IDs and old/missing/unknown values. Add Admin GET legacy normalization cases using existing request helpers. Run these three suites before implementation to observe expected contract failures.

- [ ] **Switch shared IDs, registry, and API together.** The old IDs all resolve to the new default; no database write occurs on reads:

```js
export const HOMEPAGE_TEMPLATE_IDS = Object.freeze(['search-first', 'category-first', 'newest-first']);
export const DEFAULT_HOMEPAGE_TEMPLATE = 'search-first';
export const normalizeHomepageTemplate = value => HOMEPAGE_TEMPLATE_IDS.includes(value) ? value : DEFAULT_HOMEPAGE_TEMPLATE;
```

The UI registry retains `id`, `label`, `description` only. Labels are `ค้นหาก่อน`, `เลือกหมวดหมู่`, `เพิ่มเข้ารายการล่าสุด`; descriptions explain search controls, category groups, and directory-added dates respectively. Remove `compactHero`/`sectionOrder` expectations.

```js
api.get('/homepage-config/', async c => {
  if (!c.env.DB) return c.json({ error: 'DB not available' }, 500);
  const row = await c.env.DB.prepare('SELECT setting_value FROM settings WHERE setting_key = ?').bind('homepage_template').first();
  c.header('Cache-Control', 'no-store');
  return c.json({ template: normalizeHomepageTemplate(row?.setting_value) });
});
// Axios client export:
export const homepageConfigAPI = { get: () => client.get('/homepage-config/') };
```

Delete `/summary/`'s fifth query (settings lookup) and `homepage_template` field; preserve its first four queries and metric choices. The Admin handler already imports the shared allowlist and normalizer, so preserve its manager checks, batch/audit and CSRF middleware unchanged.

- [ ] **Replace HomePage with the small configuration wrapper.** Load metadata immediately through the renderer, independently of configuration; a later selected template may trigger a new metadata request, whose stale-response guard was added in Task 4. An Admin override skips public configuration fetch:

```jsx
export default function HomePage({ templateOverride, previewMode = false }) {
  const [published, setPublished] = useState(DEFAULT_HOMEPAGE_TEMPLATE);
  useEffect(() => {
    if (templateOverride != null) return;
    let active = true;
    homepageConfigAPI.get()
      .then(response => { if (active) setPublished(normalizeHomepageTemplate(response.data?.template)); })
      .catch(() => { if (active) setPublished(DEFAULT_HOMEPAGE_TEMPLATE); });
    return () => { active = false; };
  }, [templateOverride]);
  return <DiscoveryHome templateId={normalizeHomepageTemplate(templateOverride ?? published)} previewMode={previewMode} />;
}
```

Remove all ranking/summary imports and old hero code from HomePage. StatsPage owns the extracted content. Remove dead old hero and old template-specific CSS from `stats.css`, retaining summary, toolbar, table and methodology styles.

- [ ] **Update Admin previews and preserve draft race behavior.** Keep all existing state/save logic. Replace old ordered-section thumbnail markup with three compact semantic visual structures: search bar plus cards; category tiles plus grouped rows; dated list plus creator avatars. Use `aria-hidden="true"` for decorative thumbnails. Keep existing template-specific thumbnail classes and selected/published markers. Add preview-scoped selectors only where Admin button/input styles override the directory styles.

Retain the existing pending-save test: select category-first, start saving, select newest-first before it resolves, then resolve the category-first save; published must be category-first and draft must remain newest-first. All existing failure, duplicate-save and staff cases must still pass with new IDs.

- [ ] **Replace old layout-order tests with user behavior assertions.** Mock `homepageConfigAPI`, `directoryAPI`, plus summary/ranking spies. Keep renderer tests in Task 4; Home wrapper tests cover integration:

```jsx
it('uses search-first when config fails while directory succeeds', async () => {
  homepageConfigAPI.get.mockRejectedValue(new Error('unavailable'));
  directoryAPI.getList.mockResolvedValue({ data: { total: 1, count: 1, results: [{ id: 1, name: 'Aiko', slug: 'aiko', category: 'gaming', affiliation: 'indie', avatar: '', created_at: null }], category_counts: [{ category: 'gaming', count: 1 }] } });
  const { container } = render(<MemoryRouter><HomePage /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'search-first');
  expect(summaryAPI.get).not.toHaveBeenCalled();
  expect(rankingsAPI.getList).not.toHaveBeenCalled();
});
it('uses an Admin override without reading published configuration', async () => {
  const { container } = render(<MemoryRouter><HomePage templateOverride="newest-first" previewMode /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: 'เพิ่มเข้ารายการล่าสุด' });
  expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'newest-first');
  expect(homepageConfigAPI.get).not.toHaveBeenCalled();
});
```

Add missing/unknown config cases, and successful `category-first`/`newest-first` public values. Keep meaningful authorization and publishing tests instead of asserting decorative CSS section order.

- [ ] **Update Cypress fixtures and end-to-end journeys.** Add a directory fixture with only the seven allowlisted fields, two categories, fixed creation timestamps and an empty avatar fallback. Extend `cy.stubPublicApi()` to intercept configuration and directory paths while retaining existing ranking/search stubs. Directory intercepts filter `results` by category and return full fixture category counts so previews can request samples. In the Admin spec, public config reads the same mutable `publishedTemplate` that changes only on successful PUT:

```js
cy.intercept({ method: 'GET', pathname: '/api/v1/homepage-config/' }, req => req.reply({ template: publishedTemplate })).as('getHomepageConfig');
// In the manager publication journey after selecting category-first:
cy.contains('button', 'บันทึกเป็นหน้าแรก').click();
cy.wait('@saveHomepageTemplate').its('request.body.homepage_template').should('eq', 'category-first');
cy.visit('/');
cy.wait('@getHomepageConfig');
cy.get('.homepage').should('have.attr', 'data-template', 'category-first');
```

Preserve unsaved draft, keyboard selection, staff redirect and 390px cases. Replace the old thumbnail grid-area assertions with checks that each thumbnail exists and each preview exposes its intended discovery controls/content. Add search-form and profile-link containment within Admin. Public Home E2E must submit a name, follow a category, reach `/stats`, and verify current template content. At 390×844 and desktop widths, verify no horizontal overflow, visible keyboard focus and a useful first screen. All API requests in these journeys use local fixtures/intercepts.

- [ ] **Update project documentation and verify the completed integration.** Document directory/config routes, summary field removal, new Home/Stats responsibilities, legacy fallback and the new files. Mark the September 23 homepage-template spec as superseded by the approved September 24 design without rewriting its historical content. Do not claim that moving rankings changes provider-policy obligations.

Run the focused shared, integration and component suites listed in this task, then `npm run build` and:

```powershell
npm run test:e2e -- --spec "cypress/e2e/public/home.cy.js,cypress/e2e/public/stats.cy.js,cypress/e2e/public/search.cy.js,cypress/e2e/admin/homepage-template.cy.js"
```

Commit as `feat: publish discovery homepage templates`. Run `npm test` once for the final shared-contract regression check; do not repeatedly broaden checks after a clean pass unless a new change or failure warrants it.

## Completion review

- [ ] Compare the final diff with all ten spec acceptance criteria. Confirm Home/preview have no summary/ranking requests, group counts are global, missing dates remain honest, and all three layouts are visibly distinct.
- [ ] Inspect both public and Admin preview at 390×844 and desktop, in light and dark themes. Use stubbed data; check search, category links, navigation, first-screen creator visibility, focus and overflow.
- [ ] Run `git diff --check`, inspect changed files and report actual test/build/SQL/browser results with any limitations. No deployment is part of this plan.
- [ ] Follow the selected execution skill's final review process. Fix findings before handoff.

## Plan self-review

All spec sections map to Tasks 1–5: metadata/API boundaries (1, 5), routes/stats (2), query-prefill (3), layouts/curation/dates/states (4), configuration/Admin/legacy persistence (5). The five Review Focus conditions each have a concrete test or SQL check in their owning task. Transport names distinguish public `template` from Admin `homepage_template`; counts distinguish filtered `total`, page `count`, and global `category_counts`. The plan adds no provider, dependency, schema migration, metric collection change, or publication step.
