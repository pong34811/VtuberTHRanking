---
name: vtuberthranking-ops-workflow
description: Deploy VtuberTHRanking, migrate D1, verify production.
version: 0.1.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [VTuber, Cloudflare, Pages, D1, Worker, Deployment]
    related_skills: [thai-vtuber-ranking-ux, thai-vtuber-ranking-ops]
---

# VtuberTHRanking Ops Workflow

Reproducible workflow for VtuberTHRanking Cloudflare Pages + Functions + D1 + Worker releases, with skill inventory and project file updates. Covers Issue-driven changes, commit/push, Worker and Pages deploy, D1 migration, production smoke, docs updates, and moving skills to .agents.

## When to Use

- Deploy a new feature/fix on main after Issue approval
- Apply D1 migrations to remote database
- Verify production endpoints after deploy
- Update plan.md with deployment evidence
- Organize project skills under .agents/skills and maintain SKILL_INDEX.md
- Batch git commits for Issue #10 style daily directory sync releases

## Prerequisites

- Node 24, wrangler 4.x installed
- Logged in wrangler for account pong34811@gmail.com
- D1 binding vtuberthai-db id 9585907e-612d-4cc3-84b4-f75a41690989
- Secrets YOUTUBE_API_KEY, UPDATER_RUN_TOKEN set in Worker
- Work on main only, no branches unless instructed

## How to Run

Invoke through `terminal` for git/build/deploy commands, `read_file`/`patch`/`write_file` for docs, and `skill_manage` for skill updates. Follow the numbered Procedure below.

## Quick Reference

- `git -C C:/Users/win01/Desktop/Projects/VtuberTHRanking push origin main`
- `npx wrangler deploy` from worker/
- `npx wrangler d1 migrations apply vtuberthai-db --remote` from frontend/
- `npx wrangler pages deploy dist --project-name vtuberthai-ranking` from frontend/
- `git -C C:/Users/win01/Desktop/Projects/VtuberTHRanking commit -m "msg (Refs #N)"`
- `mkdir -p .agents/skills/<name> && cp skills/<name>/SKILL.md .agents/skills/<name>/`

## Procedure

1. Review plan.md and AGENTS.md for current Issue status and approval. `read_file` plan.md.
2. Ensure changes are on main. `terminal` git status.
3. Run tests and build locally. `terminal` npm ci, npm test, npm run build in frontend/.
4. Stage and commit with Refs. `terminal` git add, git commit -m "feat/fix/docs: ... (Refs #N)" and push.
5. Deploy Worker. `terminal` cd worker && npx wrangler deploy.
6. Apply D1 remote migration. `terminal` cd frontend && npx wrangler d1 migrations apply vtuberthai-db --remote.
7. Deploy Pages. `terminal` cd frontend && npx wrangler pages deploy dist --project-name vtuberthai-ranking.
8. Smoke production. `terminal` curl https://vtuberthai-ranking.pages.dev/api/v1/intro-homepage-config/ and directory endpoint. Expect 200.
9. Update plan.md with deploy evidence and smoke results. `patch` plan.md section for Issue.
10. Commit docs update. `terminal` git add plan.md && git commit -m "docs: record ... (Refs #N)" && git push.
11. Manage project skills. Move repo skills to .agents/skills, remove skills/ dir, update .agents/SKILL_INDEX.md, commit.
12. Verify. Run `terminal` git log --oneline -3 and check remote URLs.

## Pitfalls

- Do not enable directory_sync_enabled on production before manager approval
- Do not push secrets to frontend
- Directory sync failures must not stop statistics pipeline
- Keep description <=60 chars in skills
- Use Refs #N not Fixes/Closes

## Verification

`terminal` curl -s https://vtuberthai-ranking.pages.dev/api/v1/intro-homepage-config/ returns {"template":"sculpture-index-3d"} and `terminal` git status shows clean working tree.

## References

- `references/deploy-checklist.md` — full checklist covering pre-merge, commit, Worker deploy, D1 migration, Pages deploy, production smoke, docs update, skill management, and final state. Load with `skill_view(file_path="references/deploy-checklist.md")` before any release.

