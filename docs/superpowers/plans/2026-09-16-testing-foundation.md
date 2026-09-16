# Testing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้โปรเจกต์มี runtime contract และโครงสร้าง Vitest ที่รันได้จริง พร้อม unit tests สำหรับ server domain, password และ updater worker โดยไม่เปลี่ยนพฤติกรรมผู้ใช้

**Architecture:** คง Cloudflare Pages Functions และ React application ไว้ใน `frontend` ตามเดิม แต่แยก tests ตามชนิดและ source responsibility ก่อนเริ่มแยก production modules การแก้ production code ในระยะนี้จำกัดเฉพาะการ export `updateAll` เพื่อทดสอบ worker behavior โดยตรง

**Tech Stack:** Node.js 20.19 ขึ้นไป, React 19, Vite 8, Vitest 3, Hono, Cloudflare Workers และ D1

**Spec:** `docs/PROJECT_STRUCTURE.md`

## Global Constraints

- ใช้ Node.js 20.19 ขึ้นไปตาม runtime floor ของ Vite 8
- ห้ามเชื่อมต่อ production D1 หรือ YouTube API จาก automated tests
- Tests ต้องตรวจ observable behavior ไม่ตรวจ implementation detail
- ทุก production behavior ที่เปลี่ยนต้องผ่านวงจร failing test, minimal implementation และ passing test
- ไม่ย้าย public routes, admin routes หรือ React features ในระยะนี้
- ไม่ commit credentials, `.env`, screenshots, videos หรือ generated downloads

---

### Task 1 Runtime contract and test commands

**Files:**
- Create: `.nvmrc`
- Modify: `frontend/package.json`
- Modify: `frontend/vitest.config.js`
- Create: `frontend/tests/setup/node.js`

**Interfaces:**
- Consumes: Node runtime available to npm
- Produces: `npm test`, `npm run test:unit`, `npm run test:integration` and `npm run test:coverage`

- [ ] **Step 1: Record the current runtime failure**

Run from `frontend`:

```powershell
node --version
npm test
npm run build
```

Expected on the current machine: Node reports `v16.20.2`; Vitest fails while resolving Vite config and Vite build fails while importing `styleText`.

- [ ] **Step 2: Declare the supported runtime**

Create `.nvmrc`:

```text
20.19.0
```

Add to `frontend/package.json`:

```json
"engines": {
  "node": ">=20.19.0"
}
```

- [ ] **Step 3: Add test dependencies and scripts**

From `frontend`, install the test dependencies through npm so `package.json` and `package-lock.json` remain synchronized:

```powershell
npm install --save-dev @vitest/coverage-v8@3.2.7 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Replace the test scripts with:

```json
"test": "vitest run",
"test:unit": "vitest run tests/unit",
"test:integration": "vitest run tests/integration",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: Configure separate Node and DOM test projects**

Update `frontend/vitest.config.js` so files under `tests/unit/components` use jsdom and all server, worker and integration tests use Node. Load `tests/setup/node.js` for stable Web API globals without changing application modules.

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,jsx}'],
    environmentMatchGlobs: [['tests/unit/components/**', 'jsdom']],
    setupFiles: ['./tests/setup/node.js'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/**/*.js', 'src/**/*.{js,jsx}', '../worker/**/*.js'],
      exclude: ['src/main.jsx', 'src/components/ui/**'],
    },
  },
});
```

Create `frontend/tests/setup/node.js`:

```js
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Verify with the supported runtime**

Run from `frontend` under Node 20.19 or newer:

```powershell
npm test
npm run build
```

Expected: both commands exit with status 0. If the host still uses Node 16, stop and report the runtime blocker rather than claiming the suite passes.

- [ ] **Step 6: Commit the runtime foundation**

```powershell
git add .nvmrc frontend/package.json frontend/package-lock.json frontend/vitest.config.js frontend/tests/setup/node.js
git commit -m "test: establish supported vitest runtime"
```

### Task 2 Split and strengthen server unit tests

**Files:**
- Delete: `frontend/tests/admin.test.js`
- Create: `frontend/tests/unit/server/password.test.js`
- Create: `frontend/tests/unit/server/admin-domain.test.js`
- Create: `frontend/tests/integration/auth.test.js`
- Create: `frontend/tests/integration/admin-api.test.js`
- Create: `frontend/tests/helpers/d1.js`

**Interfaces:**
- Consumes: exports from `server/password.js`, `server/admin-domain.js`, `server/auth.js` and `server/admin.js`
- Produces: focused tests and `createD1Stub(responses)` for later API suites

- [ ] **Step 1: Add the D1 test double**

Create a test-only helper whose prepared statement records SQL and bound values, then resolves queued `first`, `all` and `run` results. The returned object must expose `{ db, calls }`; each call record must have `{ sql, values, operation }`.

```js
export function createD1Stub(responses = []) {
  const calls = [];
  const queue = [...responses];
  const prepare = sql => {
    let values = [];
    const statement = {
      bind: (...next) => { values = next; return statement; },
      first: async () => execute('first'),
      all: async () => execute('all'),
      run: async () => execute('run'),
    };
    const execute = operation => {
      calls.push({ sql, values, operation });
      return queue.length ? queue.shift() : operation === 'all' ? { results: [] } : null;
    };
    return statement;
  };
  return {
    calls,
    db: { prepare, batch: async statements => Promise.all(statements.map(statement => statement.run())) },
  };
}
```

- [ ] **Step 2: Move password characterization tests**

Create `password.test.js` with literal boundary cases for lengths 3, 4, 128 and 129; verify a valid password round-trip, wrong password rejection and malformed encoded hashes returning `false`.

- [ ] **Step 3: Run password tests**

```powershell
npm run test:unit -- tests/unit/server/password.test.js
```

Expected: all password behaviors pass against existing production code.

- [ ] **Step 4: Move domain characterization tests**

Create `admin-domain.test.js` covering:

- competition ranking order and ties for followers, views and videos
- rank change calculated from a previous ranking
- current, previous and next month boundaries including January rollover
- monthly and all-time selection validation
- CSV quoting, embedded quotes and formula injection prevention
- channel slug, date, URL, enums and active-state validation
- body rejection for wrong content type, oversized body, arrays and unknown fields

Use hand-derived literal expectations and one behavior per test.

- [ ] **Step 5: Run domain tests**

```powershell
npm run test:unit -- tests/unit/server/admin-domain.test.js
```

Expected: all documented current behaviors pass. Any unexpected failure becomes a separately approved bug fix; do not silently change expected values.

- [ ] **Step 6: Move API integration tests**

Create `auth.test.js` for unauthenticated `/me`, invalid origin, invalid login payload and logout without a session. Create `admin-api.test.js` for unauthenticated read and write requests. Use Hono's real `fetch` path and the D1 stub; assert response status and response body rather than mock call counts.

- [ ] **Step 7: Remove the old mixed test file and run the suite**

```powershell
npm test
```

Expected: all moved and expanded tests pass with no duplicate execution from `tests/admin.test.js`.

- [ ] **Step 8: Commit the focused server tests**

```powershell
git add frontend/tests
git commit -m "test: organize server unit and integration coverage"
```

### Task 3 Make the updater independently testable

**Files:**
- Create: `frontend/tests/unit/worker/updater.test.js`
- Modify: `worker/updater.js`

**Interfaces:**
- Consumes: D1-compatible `env.DB`, optional `env.YOUTUBE_API_KEY`, global `fetch`
- Produces: `updateAll(env, force = false)` named export while preserving the existing default Worker export

- [ ] **Step 1: Write failing tests for the worker contract**

Import `updateAll` from `../../../worker/updater.js` and cover these literal outcomes:

```js
expect(await updateAll(manualEnv)).toEqual({ ok: true, skipped: 'manual', freq: 'manual' });
expect(notDueResult).toMatchObject({ ok: true, skipped: 'not due', freq: 'hourly' });
expect(result.updated).toBe(1);
expect(result.errors).toEqual([{ id: 2, reason: 'no channel id' }]);
```

For the success path, fake only the external YouTube request and D1 boundary. Assert the resulting inserted values through the D1 stub and the returned observable summary.

- [ ] **Step 2: Run the worker test and verify RED**

```powershell
npm run test:unit -- tests/unit/worker/updater.test.js
```

Expected: FAIL because `updateAll` is not a named export.

- [ ] **Step 3: Export the existing worker function**

Change only its declaration:

```js
export async function updateAll(env, force = false) {
```

Do not change its internal behavior or default Worker handler.

- [ ] **Step 4: Run worker tests and verify GREEN**

```powershell
npm run test:unit -- tests/unit/worker/updater.test.js
npm test
```

Expected: worker tests and the complete suite pass.

- [ ] **Step 5: Commit the worker test seam**

```powershell
git add worker/updater.js frontend/tests/unit/worker/updater.test.js
git commit -m "test: cover updater worker behavior"
```

### Task 4 Verify the foundation and record the next boundaries

**Files:**
- Modify: `docs/PROJECT_STRUCTURE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: working scripts from Tasks 1 through 3
- Produces: accurate developer commands and a verified baseline for subsequent refactoring plans

- [ ] **Step 1: Run the complete verification set**

```powershell
npm test
npm run test:coverage
npm run build
```

Expected: all commands exit 0 under Node 20.19 or newer. Record test counts and coverage as baseline measurements; do not introduce a coverage threshold until backend and frontend suites exist.

- [ ] **Step 2: Update project documentation**

Replace statements saying Vitest cannot run once the supported runtime is active. Add the exact runtime requirement and commands `npm test`, `npm run test:unit`, `npm run test:integration` and `npm run test:coverage`.

- [ ] **Step 3: Reconcile the repository diff**

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: only the runtime, dependency, test and documentation files in this plan are changed; `git diff --check` reports no errors.

- [ ] **Step 4: Commit the verified foundation documentation**

```powershell
git add README.md docs/PROJECT_STRUCTURE.md
git commit -m "docs: record testing foundation"
```

## Follow-up plans

After this plan passes, create and execute these independently reviewable plans in order:

1. `backend-route-decomposition` — extract public and admin route modules behind characterization tests
2. `frontend-feature-decomposition` — split large admin screens and consolidate duplicated UI wrappers
3. `cypress-e2e` — add isolated test environment, Cypress configuration, fixtures, commands and public/admin journeys

