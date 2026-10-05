# ดัชนีไฟล์โครงการ VtuberTHRanking

อัปเดต: 2026-10-05 Asia/Bangkok

## โครงสร้างหลัก
- `AGENTS.md` – กติกา repo, branch policy, workflow Issue, testing
- `plan.md` – แผนพัฒนา, สถานะ Issue #4 #6 #7 #8 #9 #10, เกณฑ์ตรวจรับ, ผล local และ deployment
- `docs/DAILY_DATA_SYNC.md` – รายละเอียด Issue #10 daily directory sync, prerequisites, enablement steps

## Frontend
- `frontend/src/` – React pages, components/ui, admin features, styles
- `frontend/server/` – Hono API routes, admin.js, ranking-service.js, site-config.js, request-validation.js
- `frontend/functions/api/[[path]].js` – Cloudflare Pages Functions entry
- `frontend/migrations/0010_daily_directory_sync.sql` – D1 tables: youtube_profile_state, directory_candidates, directory_sync_lease/runs, settings default
- `frontend/cypress/e2e/admin/system-history.cy.js` – Cypress journeys ระบบ audit, settings, daily directory sync UI
- `frontend/tests/integration/` – admin-data.test.js, directory-sync.test.js
- `frontend/tests/unit/` – components, shared/youtube-profile.test.js

## Shared
- `shared/youtube-profile.js` – youtubeReference, readYouTubeProfile, isIndependentThaiVTuber, natural-key lookup
- `shared/youtube-statistics.js` – validation readYouTubeStatistics

## Worker
- `worker/updater.js` – cron 0 * * * *, pipeline ranking stats, calls syncDirectory
- `worker/directory-sync.js` – lease/fence, daily gate Asia/Bangkok, Pixela roster HTMLRewriter, YouTube search, candidate admission, profile refresh baseline
- `worker/wrangler.toml` – binding D1, secrets YOUTUBE_API_KEY, UPDATER_RUN_TOKEN

## Config & CI
- `frontend/wrangler.toml` – Pages binding D1, compatibility_date
- `.github/workflows/ci.yml` – Node 24, npm ci/test/build, test:e2e, D1 local migrations smoke

## คีย์ฟีเจอร์ล่าสุด Issue #10
- Migration 0010, directory sync daily, admin toggle `directory_sync_enabled`
- API: `GET /api/v1/admin/directory-sync`, `POST /api/v1/admin/directory-candidates/:id/ignore`
- UI SettingsTab directory section, candidate list withข้ามช่องนี้
- Tests: Vitest 541 tests, Cypress 4/4 system-history

## วิธีใช้งาน
- `npm ci` แล้ว `npm run build` ใน frontend/
- Deploy Worker: `npx wrangler deploy` จาก worker/
- Deploy Pages: `npx wrangler pages deploy dist --project-name vtuberthai-ranking`
- Apply D1 remote: `npx wrangler d1 migrations apply vtuberthai-db --remote`

ดู `plan.md` สำหรับสถานะอนุมัติและขั้นเปิดใช้งาน production
