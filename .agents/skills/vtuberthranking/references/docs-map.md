# Document map and freshness notes

Reviewed all 22 `docs/` files on 2026-10-05. Paths below resolve from this reference into the owning repository. Read the relevant source as well: document dates, approval labels, completion reports, and unchecked boxes do not establish today's runtime behavior.

## Core references

| Document | Read when | Evidence and limits |
| --- | --- | --- |
| [PRD](../../../../docs/PRD.md) | Product scope and platform boundaries | YouTube ranking/discovery/admin scope; future features and backlog require checking current code. |
| [Project structure](../../../../docs/PROJECT_STRUCTURE.md) | Finding modules, routes, and test ownership | Includes both actual and proposed trees; some descriptions and commands are stale. |
| [API specification](../../../../docs/API_SPEC.md) | Directory, rankings, profile, history, compare, summary | Detailed response contracts; some limitations contradict newer sections and source. |
| [Database](../../../../docs/DATABASE.md) | Schema, relationships, settings, migrations | Migration SQL is authoritative; this document stops at 0007 and describes an older publication flow. |
| [Ranking algorithm](../../../../docs/RANKING_ALGORITHM.md) | Metrics, ties, month cutoffs, rank movement | Accumulated counters and Bangkok periods remain useful; cap, NEW, retry, and scheduling notes are historical. |
| [Page audit](../../../../docs/page-audit-2026-09-17.md) | Recovery states, accessibility, datetime handling | Historical tests/browser observations; old search/compare pages and test counts are not current guarantees. |
| [YouTube policy review](../../../../docs/YOUTUBE_DATA_POLICY_REVIEW.md) | Data provenance, counter precision, analytics, retention/deletion | Dated static audit plus subsequent ingestion safeguards; proposals and approval questions are not implemented lifecycle controls or legal approval. |

## Design decisions

| Document | Reusable decision | Status and scope |
| --- | --- | --- |
| [2026-09-23 homepage templates](../../../../docs/superpowers/specs/2026-09-23-homepage-template-settings.md) | Draft/save distinction, manager guard, persistence and audit | Explicitly superseded. Old template IDs and summary-based configuration must not be restored. |
| [2026-09-23 product design](../../../../docs/superpowers/specs/2026-09-23-vtuber-ranking-product-design.md) | Counter semantics, independent failure states, readable Admin tables | Historical proposal; its route map and pipeline assumptions predate later changes. |
| [2026-09-24 discovery/stats design](../../../../docs/superpowers/specs/2026-09-24-discovery-home-and-stats-design.md) | Metadata-only discovery, global facets, three layouts, manager preview | Approved design; current routes supersede its original `/`, `/search`, `/compare` map. |
| [2026-09-24 contact sheet](../../../../docs/superpowers/specs/2026-09-24-contact-sheet-homepage.md) | Portrait-led grid, full names, agency labels, container responsiveness, reduced motion | Recorded implementation/acceptance for the discovery surface only, not a global design system. |
| [2026-09-28 CI/D1 smoke](../../../../docs/superpowers/specs/2026-09-28-github-ci-d1-smoke-design.md) | Tests/build/E2E plus real local D1 API smoke, no production credentials | Approved; `.github/workflows/ci.yml` now uses Node 24 rather than the spec's `.nvmrc` selection. |

## Implementation archive

These plans explain why modules exist and identify useful regression cases. Treat commands, task ownership, delegation requirements, and release steps as archived task context.

| Plan | Useful context |
| --- | --- |
| [2026-09-10 initial ranking](../../../../docs/superpowers/plans/2026-09-10-ranking-vtuberthai.md) | Rewritten overview of the Cloudflare architecture; dated backlog. |
| [2026-09-15 Admin](../../../../docs/superpowers/plans/2026-09-15-admin.md) | Domain fields, manager/staff boundaries, reports, audit, setup/session design; later videos support supersedes its two-metric constraint. |
| [2026-09-16 testing foundation](../../../../docs/superpowers/plans/2026-09-16-testing-foundation.md) | Node/jsdom test split, D1 boundary doubles, observable behavior; old runtime and password boundaries are not current requirements. |
| [2026-09-16 backend decomposition](../../../../docs/superpowers/plans/2026-09-16-backend-route-decomposition.md) | Thin Functions entry point and public Hono router; characterization before behavior-preserving extraction. |
| [2026-09-16 frontend decomposition](../../../../docs/superpowers/plans/2026-09-16-frontend-feature-decomposition.md) | Channels shell, channel modules, management tabs and shared `useList`; no permanent ban on later UI changes. |
| [2026-09-16 Cypress](../../../../docs/superpowers/plans/2026-09-16-cypress-e2e.md) | Deterministic public/Admin journeys with intercepted APIs and stable selectors; current runner owns server startup. |
| [2026-09-23 public UX](../../../../docs/superpowers/plans/2026-09-23-vtuber-public-ux.md) | Thai enum labels, null/zero rank movement, insufficient-history states, independent requests. |
| [2026-09-23 Admin UX](../../../../docs/superpowers/plans/2026-09-23-vtuber-admin-ux.md) | One metric table, truthful movement labels, malformed audit JSON handling, clipboard failure recovery. |
| [2026-09-23 pipeline](../../../../docs/superpowers/plans/2026-09-23-vtuber-ranking-pipeline.md) | Durable run outcomes, collection failure cases, operator recalculation; current fenced publication supersedes the fixed cap/per-set transaction design. |
| [2026-09-24 discovery implementation](../../../../docs/superpowers/plans/2026-09-24-discovery-home-and-stats.md) | Directory projection, date validity, global facets, URL synchronization, cancelled responses, preview containment and save races. |

## Resolve these known discrepancies before changing behavior

Baseline checked against source on `main` during skill creation:

- **Routes:** `frontend/src/App.jsx` renders rankings at `/` and `/home`, monthly-default rankings at `/stats`, and discovery at `/discover`. `/search` redirects while preserving its query. No public `/compare` page is registered; the compare API remains.
- **Scheduling/publication:** `worker/updater.js` uses collection slots, Bangkok calendar months, a forward-only lease/fence, private staged snapshots and an atomic publication batch. Enabled categories and archived months determine `rankings_expected`; six is not a universal success count. Collection retries/budgets exist; the old 90-channel hard cap is not in the current calculation loop. Review actual capacity before increasing workload.
- **Rank movement:** `shared/ranking.js` returns `null` without a baseline. Do not recreate the older zero-as-new behavior. Filtered affiliation rankings have separate contracts in `frontend/server/public.js`; do not assume overall movement applies to subgroup ranks.
- **SQL/schema:** Inspect migrations 0008/0009, the publication journal/checkpoint tables, and current SQL. The old D1 mock description is incomplete: integration tests also use SQLite and ephemeral Miniflare D1.
- **Directory/configuration:** Current directory fields include `agency_name` and global `affiliation_counts`. Public `/homepage-config/` is separate from `/summary/`. Do not infer endpoint behavior from an old fixture alone.
- **Summary/search:** The API document's old MAX-aggregate and unsupported follower-filter notes conflict with current source/newer sections. Trace `frontend/server/public.js` before altering either behavior.
- **Runtime/tests:** Package engines say Node `>=22.12.0`; CI uses 24 because SQLite tests need newer APIs. The E2E runner starts Vite; do not launch a second server on port 5173. Historical pass counts and coverage numbers are not verification for a new diff.
- **YouTube policy:** The review records missing evidence and proposed retention/permission controls. Never infer those controls are deployed from a document or from `shared/snapshot-policy.js`'s name. Consult current official sources for a new policy assessment rather than presenting dated thresholds as current approval.
