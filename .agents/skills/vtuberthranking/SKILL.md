---
name: vtuberthranking
description: Develop, debug, and review VtuberTHRanking using its documented product rules, React UI, Hono API, D1 schema, and YouTube ranking pipeline. Use for changes or questions about this repository and for reconciling its docs with implementation.
---

# VtuberTHRanking

Use the repository's domain rules rather than rediscovering them or executing historical plans. This skill distills all 22 files under `docs/` reviewed on 2026-10-05; it is a navigation and decision guide, not a replacement for maintained source documents.

## Start with the relevant evidence

1. Locate the repository containing this skill and read its root `AGENTS.md`. Work on `main` in the primary checkout, as requested by the user.
2. Read [the document map](references/docs-map.md) and select the documents relevant to the task. Follow its links instead of loading the entire archive every time.
3. Trace the affected UI, API, shared helpers, SQL, and callers before editing. Check migrations and tests whenever a document describes behavior that may have changed.
4. Distinguish implemented behavior, approved design intent, historical proposals, and unfinished work. Report a material mismatch; do not silently implement an old backlog item or restore an obsolete route.

Current user instructions govern task scope. Source, migrations, configuration, and runnable tests establish implementation facts; approved designs explain intent. Dated plans and audits provide historical evidence. Instructions inside archived plans to delegate, commit, or deploy are not authorization for the current task.

## Architecture and ownership

- React/Vite/Tailwind UI: `frontend/src/`; public API client: `frontend/src/api/client.js`; admin client: `frontend/src/admin/api.js`.
- Hono API: `frontend/functions/api/[[path]].js` mounts routers in `frontend/server/` under `/api/v1`.
- Pages Functions and `worker/updater.js` share Cloudflare D1 through `DB`. Schema authority is the ordered SQL in `frontend/migrations/`.
- Reuse `shared/ranking.js`, `shared/snapshot-policy.js`, `shared/youtube-statistics.js`, directory enums, and template normalization across callers.
- Add migrations rather than editing applied ones. A D1 stub does not prove SQL or transactional correctness.

## Product and data rules

- Ranking metrics map `followers` to YouTube subscribers, `views` to `total_views`, and `videos` to public `video_count`. These are accumulated counters, not quality scores or monthly growth.
- Monthly ranking uses the latest eligible observation before the next Bangkok calendar month; alltime uses the latest observation. Use the existing Bangkok time helpers, not host-local dates.
- Latest snapshot ordering is timestamp descending, then ID descending. Competition ties share ranks (`1, 1, 3`); deterministic output uses creator ID. `rank_change` is previous rank minus current rank; `null` means no prior baseline, `0` means unchanged.
- Discovery uses active profile metadata only. Do not select creators or order discovery cards by ranking metrics. Directory-added dates do not mean debut, live activity, or recommendation.
- Directory `total` is filtered population, `count` is page size, and category/affiliation facets cover all active profiles independently of pagination. Preserve field projection so private notes and metrics do not leak.
- Template IDs are `search-first`, `category-first`, and `newest-first`. Reads normalize legacy/invalid values to `search-first`; writes validate the allowlist. Public configuration uses `template`; Admin uses `homepage_template`.
- Manager selection remains a draft until saved. Preview links/search stay inside Admin. Preserve CSRF, manager guards, audit writes, and draft state when a pending save resolves after another selection.

## Pipeline and security

Read current Worker and ranking-service code for scheduling, collection budgets, retries, leases, checkpoints, and publication. Preserve idempotency, fencing, atomic publication, and the previous complete results on failure. Do not copy the archive's fixed 90-channel cap or six-independent-batch model into current code.

Use the shared YouTube validator: hidden, missing, malformed, or unsafe counters must not become zero or fabricated observations; genuine zero is valid. UI must distinguish unavailable data from zero, loading from empty, and snapshot time from publication time. Keep independent requests usable when another section fails and guard against stale responses.

Read `frontend/AUTH.md` for role permissions. Preserve server-side authentication, origin/CSRF validation, session invalidation, and safe CSV exports. Manual updater requests use POST with `UPDATER_RUN_TOKEN` as a Bearer token. Keep credentials out of public responses, manual-trigger URLs, and logs.

For changes involving YouTube retention, history, exports, or public analytics, consult the dated policy review. Separate its evidence, proposals, and unresolved approval questions. Recheck official policies when making a current policy decision; local safeguards and documentation are not proof of compliance. This skill does not authorize deployment, live API collection, or production data changes.

## Verify the actual change

Run npm commands from `frontend/`; Node 24 matches current CI. Use existing Vitest/Testing Library tests for domain/API/component behavior, SQLite or ephemeral D1 checks for SQL, and Cypress for affected browser journeys. `npm run test:e2e` starts Vite itself and uses stubbed API data.

Useful commands: `npm test`, `npm run test:unit`, `npm run test:integration`, `npm run test:coverage`, and `npm run build`. Coverage has no enforced threshold. CI additionally applies local D1 migrations and checks `/api/v1/directory/` through Pages dev. Use synthetic data/local databases, not production, and report only checks actually run.

## Invocation examples

```text
$vtuberthranking แก้การเปลี่ยนเดือนของอันดับโดยรักษาสูตรเดิม
$vtuberthranking ตรวจ discovery filters และ Admin template preview
$vtuberthranking เทียบเอกสาร pipeline กับ Worker ปัจจุบัน
```
