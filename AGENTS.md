# Repository Guidelines

## Branch & Workspace Policy

Work only on `main` in the primary checkout. Do not create branches or worktrees unless the user explicitly changes this instruction.

## Project Structure & Module Organization

- `frontend/src/`: React pages, reusable components, admin features, and styles. Shared UI primitives live in `components/ui/`; static assets live in `frontend/public/`.
- `frontend/functions/api/[[path]].js`: Cloudflare Pages Functions entry point; Hono routes and business logic live in `frontend/server/`.
- `shared/`: ranking, snapshot, and YouTube policies reused by the API and updater.
- `worker/`: scheduled YouTube statistics updater and its Wrangler configuration.
- `frontend/migrations/`: numbered D1 SQL migrations. `docs/` contains API, database, and product specifications.

## Build, Test, and Development Commands

Run commands from `frontend/`. Use Node.js 24 to match CI; some SQLite tests require APIs unavailable in Node 22.12.

- `npm ci`: install dependencies from the committed lockfile.
- `npm run build`: generate the production bundle in `dist/`.
- `npm run db:migrate:local`: apply migrations to local D1.
- `npm run dev:api`: serve the built bundle and API at `127.0.0.1:8788`.
- `npm run dev`: start Vite at `127.0.0.1:5173`, proxying API requests to Pages.
- `npm test`: run all Vitest tests.
- `npm run test:e2e`: start a temporary Vite server and run Cypress; keep port 5173 free.

## Coding Style & Naming Conventions

Use JavaScript ES modules and two-space indentation. Match nearby quote and semicolon conventions; no dedicated lint or formatter script is configured. Name React components in PascalCase (`RankBadge.jsx`), functions in camelCase, and server modules in kebab-case (`ranking-service.js`). Reuse existing components and `shared/` policies. Add sequentially numbered migrations rather than rewriting applied migrations.

## Testing Guidelines

Vitest covers unit and integration tests under `frontend/tests/`; React tests use Testing Library and jsdom. Name tests `*.test.js` or `*.test.jsx`. Cypress journeys live under `frontend/cypress/e2e/` and stub API requests.

Use `npm run test:unit`, `npm run test:integration`, or `npm run test:coverage` for focused checks. Coverage uses V8 with no enforced threshold. Add regression coverage for changed behavior. Before submitting, run tests and the build; CI also runs Cypress and a local D1 API smoke check.

## Commit & Pull Request Guidelines

History uses prefixes such as `feat:`, `fix:`, `test:`, `docs:`, and `ci:`. Write concise, imperative subjects. PRs should explain the problem, resulting behavior, and validation; link relevant issues and include screenshots for visual changes. Identify migration or configuration requirements.

## Security & Configuration Tips

Copy `frontend/.dev.vars.example` to `.dev.vars` for local setup. Keep secrets, Wrangler state, and generated artifacts out of Git. Preserve session authentication, CSRF checks, and parameterized SQL when changing API routes.
