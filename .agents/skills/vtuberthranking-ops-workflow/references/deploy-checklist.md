# VtuberTHRanking Deploy Checklist

Use when deploying a feature/fix from main to production.

## Pre-merge
- [ ] plan.md reviewed; Issue approved for implementation
- [ ] Work on main only, no branches
- [ ] npm ci, npm test (48 files / 541 tests), npm run build pass in frontend/
- [ ] Cypress system-history journeys pass

## Commit
- [ ] git add all changed + new files
- [ ] git commit -m "feat/fix/docs/test/ci: ... (Refs #N)" — never use Fixes/Closes
- [ ] git push origin main

## Worker deploy
- [ ] cd worker && npx wrangler deploy
- [ ] Verify triggers 0 * * * * still active
- [ ] Note version ID from output

## D1 migration
- [ ] cd frontend && npx wrangler d1 migrations apply vtuberthai-db --remote
- [ ] Confirm migration 0010_daily_directory_sync.sql applied
- [ ] Do NOT enable directory_sync_enabled before manager approval

## Pages deploy
- [ ] cd frontend && npx wrangler pages deploy dist --project-name vtuberthai-ranking
- [ ] Confirm 24 files uploaded

## Production smoke
- [ ] curl https://vtuberthai-ranking.pages.dev/api/v1/intro-homepage-config/ → 200 {"template":"sculpture-index-3d"}
- [ ] curl https://vtuberthai-ranking.pages.dev/api/v1/directory/?limit=1 → 200 with data
- [ ] curl https://vtuberthai-ranking.pages.dev/api/v1/admin/settings → 401 unauthenticated
- [ ] No secrets leaked to frontend

## Docs update
- [ ] patch plan.md with push, deploy, smoke evidence
- [ ] git add plan.md && git commit -m "docs: record ... (Refs #N)" && git push

## Skill management
- [ ] Move repo skills to .agents/skills
- [ ] Remove skills/ directory
- [ ] Update .agents/SKILL_INDEX.md
- [ ] git add .agents && git commit -m "refactor: ... (Refs #N)" && git push

## Final
- [ ] git status clean
- [ ] Issue remains open pending review/approval
