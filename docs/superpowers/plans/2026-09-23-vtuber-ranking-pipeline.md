# VTuber Ranking Refresh and Publication Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect scheduled YouTube snapshot collection to monthly and all-time ranking publication, and make each run's result visible in the admin console.

**Architecture:** Record pipeline runs in D1. Collect and batch-write channel snapshots, then call one shared ranking service for the current Bangkok month and all-time period across followers, views, and videos. Each period/metric ranking set is committed with one D1 batch; incomplete runs are recorded and never reported as fully successful. Keep the existing 90-channel ranking cap and the manager's manual recalculation action.

**Tech Stack:** Cloudflare Workers Cron Triggers, D1 prepared statements and `batch()`, Cloudflare Pages/Hono admin API, JavaScript modules, existing React admin console.

**Spec:** `docs/superpowers/specs/2026-09-23-vtuber-ranking-product-design.md`

## Global Constraints

- “Monthly ranking continues to mean ranking by accumulated channel totals at the snapshot used for that calendar ranking period. It does not mean the amount gained during that month.”
- “After a successful snapshot refresh, calculate the affected monthly and all-time ranking sets using the approved existing formula.”
- “Make each run idempotent so retrying after a partial failure does not duplicate or corrupt published rankings.”
- “Publish a complete ranking set atomically; public readers should see the previous complete set until the new set is ready.”
- “Record run start/end time, period, number of channels processed, and a concise success/failure reason for the admin console.”
- “Respect Cloudflare Worker execution and D1 batch limits. Confirm the current collection cap, retry behavior, and schema before implementation; do not assume a larger batch fits one invocation.”
- “Do not deploy changes to the public Cloudflare site as part of this design approval.”
- Preserve the existing uncommitted Bangkok month-boundary edits in `frontend/server/admin-domain.js` and `frontend/server/ranking-period.js`; only extract the ranking calculation helper from the former.

## Review Focus

- Frequency is `manual`, invalid, not due, due, or forced: preserve the documented frequency behavior and make skipped runs explicit.
- One YouTube channel has no channel ID, returns no item, rate-limits, or errors: record the channel error, keep the run from being marked successful, and do not calculate rankings from a partial snapshot refresh.
- A snapshot insert or ranking batch fails: preserve the previous complete ranking set for that metric/period and record an actionable run outcome.
- Active channel count exceeds 90: fail visibly before publication rather than partially writing rankings.
- Worker stops between start and completion: leave a run record that administrators can identify as incomplete/stale.

---

### Task 1: Extract the shared ranking calculation service

**Files:**
- Create: `shared/ranking.js`
- Create: `frontend/server/ranking-service.js`
- Modify: `frontend/server/admin-domain.js`
- Modify: `frontend/server/admin.js`

**Interfaces:**
- `competitionRanks(rows, category, previous)` returns rows with `score`, `rank`, and nullable `rank_change` (`null` means no prior rank; `0` means unchanged).
- `nextMonthBoundary(value)` and `previousMonth(value)` preserve the current Bangkok UTC+7 month-cutoff calculation and accept the existing `YYYY-MM-01` selection value.
- `calculateRanking(db, filter, extraStatements = [])` reads the selected cutoff snapshots and prior ranks, enforces the 90-channel cap, then atomically replaces one period/category ranking set and returns `{ count }`.
- The admin route supplies its existing audit statement through `extraStatements`; the Worker calls the same service without a user audit statement.

- [ ] Keep each period/category replacement within one D1 batch:

```js
await db.batch([
  db.prepare("DELETE FROM rankings WHERE period=? AND category=? AND month IS ?")
    .bind(filter.period, filter.category, filter.month),
  ...ranked.map((row) => db.prepare(
    "INSERT INTO rankings (vtuber_id,period,category,month,rank,score,rank_change,subscriber_count,total_views,video_count,status,calculated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'active',datetime('now'))"
  ).bind(row.vtuber_id, filter.period, filter.category, filter.month, row.rank, row.score,
    row.rank_change, row.followers, row.total_views, row.video_count)),
  ...extraStatements,
]);
```

- [ ] Move `competitionRanks`, `nextMonthBoundary`, and `previousMonth` to `shared/ranking.js`; preserve stable tie ordering, competition rank numbering, and the exact existing UTC+7 formulas.
- [ ] Implement `calculateRanking` using the current Bangkok `nextMonthBoundary`/`previousMonth` semantics and existing SQL columns.
- [ ] Use one `DB.batch()` containing delete, all inserts, and optional audit statement so a failed statement rolls back the selected ranking set.
- [ ] Replace inline ranking SQL in `admin.js` with the service while preserving request validation, manager guard, response status, and audit log.
- [ ] Re-export the three moved functions from `admin-domain.js`; keep `currentMonth` imported from the user's existing `ranking-period.js` and retain all unrelated helpers.

### Task 2: Add durable pipeline run records

**Files:**
- Create: `frontend/migrations/0006_ranking_pipeline_runs.sql`
- Modify: `docs/DATABASE.md`

**Interfaces:**
- `ranking_pipeline_runs` stores `id`, `trigger_source`, `frequency`, `status`, `started_at`, nullable `completed_at`, `channels_total`, `snapshots_written`, `rankings_published`, `errors_json`, and `error_summary`.
- Status values: `running`, `succeeded`, `partial`, `failed`. A skipped frequency check returns a structured response without writing a noisy run-history row.

- [ ] Create an additive migration with this table contract:

```sql
CREATE TABLE ranking_pipeline_runs (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('scheduled','manual')),
  frequency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  channels_total INTEGER NOT NULL DEFAULT 0,
  snapshots_written INTEGER NOT NULL DEFAULT 0,
  rankings_published INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL DEFAULT '[]',
  error_summary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX ranking_pipeline_runs_started
  ON ranking_pipeline_runs(started_at DESC, id DESC);
```

- [ ] Create the table with checks for status/trigger values and an index on `(started_at DESC, id DESC)`.
- [ ] Document the table and define a run as succeeded only after all expected period/metric sets publish.
- [ ] Keep the migration additive; do not rewrite existing rankings or snapshots.

### Task 3: Make snapshot refresh batchable and retryable

**Files:**
- Modify: `worker/updater.js`

**Interfaces:**
- `updateAll(env, force = false, metadata = {})` returns one of `{ ok: true, skipped, freq }` or `{ ok, runId, status, updated, rankingsPublished, errors }`.
- A successful full run is measured from the latest `succeeded` row in `ranking_pipeline_runs`, not `MAX(stats_snapshots.recorded_at)`.

- [ ] Keep the scheduled job promise observable to the Cron invocation:

```js
async scheduled(controller, env) {
  await updateAll(env, false, { scheduledTime: controller.scheduledTime });
}
```

- [ ] Add helpers that create/update a run row and serialize per-channel errors without including the YouTube API key.
- [ ] Preserve manual cron skipping, make `force=true` bypass the interval gate for the API-key-gated endpoint, and retry partial/failed runs on the next hourly trigger.
- [ ] Read active channels first and reject more than 90 before any snapshot or ranking write.
- [ ] Fetch each channel's YouTube statistics, treat an empty API `items` response as an error, and collect successful snapshots before writing them with a single D1 batch.
- [ ] If any channel failed, discard the collected snapshot batch, skip all ranking calculations, mark the run `partial`, store concise channel errors, and return the partial outcome; this prevents a retry from adding duplicate partial-run snapshots.
- [ ] If collection is complete, use `calculateRanking` for `{ period: 'monthly', month: currentMonth() }` and `{ period: 'alltime', month: null }`, each with `followers`, `views`, and `videos`.
- [ ] Update `rankings_published` after each successful atomic set; mark the run `succeeded` only after all six sets finish.
- [ ] On exceptions, persist `failed` or `partial` with a concise error summary, then rethrow so the Cron invocation records failure.
- [ ] Await the scheduled job in `scheduled(controller, env)` so Cloudflare records the promise outcome; keep the API-key-gated manual endpoint and return the structured result.

### Task 4: Expose recent runs to managers

**Files:**
- Modify: `frontend/server/admin.js`
- Modify: `frontend/src/admin/tabs/SettingsTab.jsx`
- Modify: `frontend/src/admin/admin.css`

**Interfaces:**
- `GET /pipeline-runs` returns the latest 10 runs with status, timestamps, frequency, channel/snapshot counts, published-set count, and error summary; manager-only.
- Settings UI displays “ยังไม่มีรอบอัปเดต”, “กำลังทำงาน”, “สำเร็จ”, “สำเร็จบางส่วน”, or “ล้มเหลว” from those rows.

- [ ] Return only this secret-free projection:

```js
{
  id, trigger_source, frequency, status, started_at, completed_at,
  channels_total, snapshots_written, rankings_published, error_summary
}
```

- [ ] Add the manager-guarded list endpoint with a fixed limit of 10 and no secrets/raw request data.
- [ ] Load run status independently from the editable site settings so a run-history error does not hide the settings form.
- [ ] Show last run time, snapshot counts, number of ranking sets published, and concise failure summary; add retry for status loading.
- [ ] Label a `running` row older than the 15-minute Cron duration limit as “หยุดก่อนเสร็จ” so an interrupted invocation is distinguishable from an active one.
- [ ] Keep the existing manual ranking calculation action and do not add an unrequested public sync trigger.

## Completion review

- [ ] Review migration ordering and confirm the Worker and Pages app use the same D1 binding/database ID.
- [ ] Trace skipped, partial, failed, and fully successful control flow and confirm no secret is returned or logged.
- [ ] Confirm each ranking set remains protected by one D1 batch and no code claims all six sets publish atomically as one transaction.
- [ ] Check the Cloudflare sources used for this design: [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Scheduled Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/), [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
