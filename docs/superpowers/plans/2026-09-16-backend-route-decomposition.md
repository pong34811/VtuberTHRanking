# Backend Route Decomposition Implementation Plan

**Goal:** ย้าย public API routes ออกจาก `frontend/functions/api/[[path]].js` ไปเป็น module `frontend/server/public.js` โดยพฤติกรรมเหมือนเดิมทุกประการ พร้อม characterization tests ที่ pin observable behavior

**Architecture:** คง Cloudflare Pages Functions wiring (`[[path]].js` ทำหน้าที่ mount routers เท่านั้น) แยก public routes เป็น Hono router module ใน `frontend/server/` เช่นเดียวกับ `server/auth.js` และ `server/admin.js` ที่มีอยู่แล้ว ไม่แยก `server/admin.js` ต่อในระยะนี้เพราะเป็น module อยู่แล้วและมี auth characterization tests คุมอยู่

**Tech Stack:** Node.js `^20.19.0 || >=22.12.0`, Hono, Vitest 3, D1 stub (`tests/helpers/d1.js`)

**Spec:** `docs/PROJECT_STRUCTURE.md`

## Global Constraints

- ห้ามเชื่อมต่อ production D1 หรือ YouTube API จาก automated tests
- Tests ต้องตรวจ observable behavior (status + response body) ไม่ตรวจ implementation detail
- การย้าย code ต้อง verbatim ไม่เปลี่ยน logic, SQL, default หรือ response shape
- ไม่ commit credentials, `.env`, screenshots, videos หรือ generated downloads

---

### Task 1 Extract public routes behind characterization tests

**Files:**
- Create: `frontend/server/public.js`
- Create: `frontend/tests/integration/public-api.test.js`
- Modify: `frontend/functions/api/[[path]].js`
- Modify: `docs/PROJECT_STRUCTURE.md`

**Interfaces:**
- Consumes: `c.env.DB` (D1-compatible), query params, JSON body
- Produces: default-export Hono app ที่มี routes `/`, `/rankings/`, `/vtubers/`, `/vtubers/:slug/`, `/vtubers/:slug/history/`, `/compare/`, `/summary/` โดย `[[path]].js` mount ที่ `/api/v1` เหมือนเดิม

- [ ] **Step 1: Write failing characterization tests for the public API**

Create `frontend/tests/integration/public-api.test.js` importing `../../server/public.js` ใช้ Hono real `fetch` path กับ D1 stub ครอบคลุม literal outcomes:

```js
await expect((await publicRequest('/')).json()).resolves.toEqual({ status: 'ok', service: 'VTuber Thai Ranking API' });
```

- status root ตอบ `{ status: 'ok', service: 'VTuber Thai Ranking API' }`
- rankings: default period/category/month, invalid period/category fallback, limit cap 100, offset negative clamp, alltime ไม่ส่ง month, pagination next/previous links, response row shape
- vtubers list: count + results, search/filter params
- vtuber detail: 404 เมื่อไม่พบ, shape มี `current_rank` และ `latest_stats`
- history: months clamp 1-12, 404 เมื่อไม่พบ
- compare: validation (ต้องมี 2-5 IDs, category ผิด → 400, JSON ผิด → 400), success shape มี color/history
- summary: shape มี total_vtubers, period_choices, category_choices
- ทุก route ตอบ 500 `{ error: 'DB not available' }` เมื่อไม่มี DB

- [ ] **Step 2: Run the public API test and verify RED**

```powershell
npm run test:integration -- tests/integration/public-api.test.js
```

Expected: FAIL เพราะ `frontend/server/public.js` ยังไม่มี

- [ ] **Step 3: Move public routes verbatim to the new module**

สร้าง `frontend/server/public.js` โดยย้าย routes ทั้งหมดจาก `api` instance ใน `[[path]].js` ไปแบบ verbatim (รวม `COLORS`) export เป็น default Hono app จากนั้นใน `[[path]].js` ลบ inline routes แล้ว mount:

```js
import publicApi from '../../server/public.js';
app.route('/api/v1', publicApi);
```

`[[path]].js` เหลือแค่ CORS, auth/admin mounting, onError และ onRequest export

- [ ] **Step 4: Run tests and verify GREEN**

```powershell
npm test
npm run test:coverage
npm run build
```

Expected: ทุกคำสั่ง exit 0 รวม public-api tests ใหม่ ไม่มี regression ใน suite เดิม

- [ ] **Step 5: Update project documentation**

แก้ `docs/PROJECT_STRUCTURE.md` §5: public API มี characterization tests แล้ว, อัปเดตจำนวน tests/coverage baseline ตามจริง

## Follow-up plans

1. `frontend-feature-decomposition` — split large admin screens and consolidate duplicated UI wrappers
2. `cypress-e2e` — add isolated test environment, Cypress configuration, fixtures, commands and public/admin journeys
