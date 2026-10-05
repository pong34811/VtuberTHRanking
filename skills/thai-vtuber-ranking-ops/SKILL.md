---
name: thai-vtuber-ranking-ops
description: Operate VtuberTHRanking Cloudflare project end-to-end.
version: 0.1.0
author: Pong34811 (pong34811), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [VTuber, Cloudflare, Pages, D1, Worker, YouTubeAPI, Admin]
    related_skills: [thai-vtuber-ranking-ux, cloudflare-fullstack-deployment]
---

# VtuberTHRanking Project Operations Skill

Skill นี้รวมโครงสร้าง repository, workflow GitHub Issues, CI/CD, และส่วนประกอบหลักของ VtuberTHRanking บน Cloudflare Pages + Functions + D1 Worker สำหรับสถิติรายชั่วโมงและ directory sync รายวัน Issue #10.

## When to Use
- ต้อง deploy Pages, Worker, หรือ apply D1 migrations
- ทำงานกับ admin API, settings, directory sync, audit logs
- อ้างถึง Issue workflow, plan.md และเกณฑ์ตรวจรับ
- แก้ฟีเจอร์ที่เกี่ยวข้องกับ ranking, discovery, profile snapshot, หรือ admin dashboard

## Prerequisites
- Node 24, wrangler 4.x, D1 binding `vtuberthai-db` (ID 9585907e-612d-4cc3-84b4-f75a41690989)
- Secrets: `YOUTUBE_API_KEY`, `UPDATER_RUN_TOKEN` (Worker only)
- ทำงานบน `main` เท่านั้น, ไม่สร้าง branch ใหม่โดยไม่มีคำสั่ง

## Project Structure
```
frontend/src/
  pages, components, admin, styles
frontend/server/
  api routing with Hono, admin.js, ranking-service.js, request-validation.js
shared/
  ranking, snapshot, youtube-statistics, youtube-profile.js (Issue #10)
worker/
  updater.js (cron 0 * * * *), directory-sync.js (daily gate), wrangler.toml
frontend/migrations/
  numbered D1 SQL migrations, 0010_daily_directory_sync.sql
docs/
  DAILY_DATA_SYNC.md, API spec
plan.md
AGENTS.md
```

## How to Run
- Install: `npm ci` in `frontend/`
- Test: `npm test` (Vitest 48 files / 541 tests)
- Build: `npm run build`
- Local API: `npm run dev:api` → 127.0.0.1:8788
- Local Vite: `npm run dev` → 127.0.0.1:5173 proxy API
- D1 local migrate: `npm run db:migrate:local`
- E2E: `npm run test:e2e` (Cypress starts Vite 5173)

## Quick Reference
- Pages deploy: `npx wrangler pages deploy dist --project-name vtuberthai-ranking` from frontend/
- Worker deploy: `npx wrangler deploy` from worker/
- Remote migrate: `npx wrangler d1 migrations apply vtuberthai-db --remote`
- Admin settings: `POST /api/v1/admin/settings` manager only, CSRF required
- Directory sync toggle: setting `directory_sync_enabled` true/false
- Candidate ignore: `POST /api/v1/admin/directory-candidates/:channel_id/ignore`

## Procedure
1. ตรวจสอบ `plan.md` เพื่อสถานะ Issue และขั้นตอนอนุมัติล่าสุด
2. ทำการเปลี่ยนแปลงบน `main` เท่านั้น, แก้ปัญหาเดียวต่อ Issue
3. เพิ่ม regression test, รัน Vitest + build, Cypress path ที่เกี่ยวข้อง
4. Commit ด้วย prefix `feat:`, `fix:`, `docs:` พร้อม `Refs #N` ไม่ใช้ `Fixes/Closes`
5. Push และ deploy Worker + Pages + apply migrations ตามขั้นตอนส่วน 5 ของ plan.md
6. Smoke production endpoints, อัปเดต plan.md, รอตรวจรับและอนุมัติปิด Issue

## Pitfalls
- อย่าเปิด `directory_sync_enabled` บน production ก่อน manager อนุมัติเปิดใช้งาน
- อย่าฝาก secrets ไป frontend, `YOUTUBE_API_KEY` อยู่ฝั่ง Worker เท่านั้น
- Directory sync failures ต้องไม่หยุด pipeline สถิติรายชั่วโมง
- ใช้ natural-key lookup เพื่อไม่สร้างช่องซ้ำ
- Cache-Control no-store สำหรับ config endpoints

## Verification
- Vitest pass 48/541, build success, Cypress system-history 4/4
- Production smoke: `intro-homepage-config/` returns template, `directory/?limit=1` returns rows, admin settings 401 unauthenticated
