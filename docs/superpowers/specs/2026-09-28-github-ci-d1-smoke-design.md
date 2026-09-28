# GitHub CI and Local D1 Smoke Test

**Status:** Conversational design approved on 2026-09-28; awaiting written-spec review.
**Date:** 2026-09-28

## Objective

Run the existing frontend checks for every GitHub push and pull request, then exercise the Pages API against a fresh local D1 database with the real migrations applied. CI must not require Cloudflare credentials, access production data, invoke the updater, or deploy the site.

## User intent and constraints

- Close the repository's missing-CI and real-D1-smoke-test backlog items.
- Use the existing GitHub repository, Node version, test commands, Pages Functions, and Wrangler D1 configuration.
- Keep the new validation isolated to a fresh GitHub-hosted runner.
- Preserve unrelated working-tree changes; the CI work must not stage or commit them.
- Keep production and deployment operations out of this workflow.

## Design

Add one GitHub Actions workflow at `.github/workflows/ci.yml`. It runs on `push` and `pull_request` with read-only repository permissions, on Ubuntu, using Node from `frontend/.nvmrc` and `npm ci` from `frontend/`.

The job runs the existing checks in this order:

1. `npm test` runs the full Vitest suite.
2. `npm run build` produces the Pages static assets.
3. `npm run test:e2e` runs the existing Cypress journeys. The existing runner starts Vite itself, and Cypress intercepts the API with local fixtures.
4. `npx wrangler d1 migrations apply vtuberthai-db --local` applies all migrations to the runner's local D1 database.
5. `wrangler pages dev dist` starts Pages Functions against that local D1 binding. A bounded Node fetch check calls `/api/v1/directory/` and fails unless it returns HTTP 200 with valid JSON containing the directory response fields used by the API contract.

The Pages server is started and checked in the same shell step so a process cleanup trap can stop it. The smoke check waits for the server for a fixed short interval, reports the response or server log on failure, and exits nonzero. Wrangler applies migrations with `--local`; Pages dev uses its local D1 mode and must not use `--remote`. This keeps the smoke test away from the configured production database.

The initial smoke test uses the empty database after migrations. It verifies that the migrations load, the Pages Function and D1 binding connect, and the directory SQL executes. Existing Vitest integration tests continue to cover request validation, response projection, and non-empty mocked result behavior. Seeding D1 with fixtures is deferred unless empty-database smoke coverage proves insufficient.

## Alternatives considered

1. **One serial workflow job (recommended):** install once and run Vitest, build, Cypress, migrations, and the D1-backed API check in order. This is the fewest moving parts and makes failures straightforward to read.
2. **Separate parallel jobs:** split unit/integration, build/Cypress, and D1 smoke. This can shorten feedback time but repeats setup and artifact handoffs before runtime becomes a problem.
3. **Stub-only CI:** run Vitest, build, and Cypress without a local D1 smoke. This is simpler but leaves SQL/runtime wiring outside automated CI.

## Error handling and security

- Any failed test, build, migration, server startup, HTTP request, or response assertion fails the workflow.
- Do not add secrets, production credentials, database exports, or `wrangler deploy` commands.
- Grant only repository read permission. Do not run the updater or make external API calls.
- The Pages dev server must be stopped even when the HTTP assertion fails.

## Acceptance criteria

1. Pushes and pull requests run the workflow.
2. The workflow uses the Node version in `frontend/.nvmrc` and installs from the lockfile.
3. Vitest, production build, and the current fixture-backed Cypress suite all run.
4. Wrangler applies migrations to local D1 and the Pages API smoke request reaches that local database.
5. A migration error, SQL/API error, invalid JSON response, or non-200 status makes the job fail.
6. The workflow has no Cloudflare secret requirement and contains no production deploy or production data-write step.

## Out of scope

- Changing application behavior, D1 schemas, ranking limits, retry policy, Cypress journeys, or deployment configuration.
- Deploying Cloudflare Pages or the updater Worker.
- Testing against a production or shared remote D1 database.
- Uploading Cypress screenshots/videos or adding a separate observability service.
