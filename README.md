# Ranking VTuber Thai

เว็บไซต์จัดอันดับ VTuber ไทย ข้อมูลจาก YouTube

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React 19 + Vite 8 + Tailwind 4 |
| API | Cloudflare Pages Functions (Hono) |
| Database | Cloudflare D1 (SQLite) |
| Auto-sync | Worker `vtuberthai-updater` (cron ทุกชั่วโมง) |
| Charts | Recharts 3 |

## เริ่มต้น (Local Development)

```bash
cd frontend && npm install
npm run dev          # http://localhost:5173 (เรียก API production ผ่าน proxy)
```

ต้องใช้ Node.js `^20.19.0 || >=22.12.0` สำหรับ Vite และ Vitest (ไฟล์ `.nvmrc` ใช้ Node.js 20.19.0)

คำสั่งตรวจสอบชุดทดสอบ (รันจากโฟลเดอร์ `frontend/`):

```bash
npm test                 # Vitest ทั้งหมด
npm run test:unit        # unit tests
npm run test:integration # integration tests
npm run test:coverage    # ทดสอบพร้อมรายงาน coverage
npm run test:e2e         # Cypress E2E (ต้องรัน dev server ก่อน)
```

ปัจจุบันมี Vitest 113 tests ผ่านทั้งหมด (66 unit รวม React component smoke tests และ 47 integration) และ Cypress 9 E2E tests ผ่านทั้งหมด (public: home, search; admin: login, channels) โดย stub API ทั้งหมด ยังไม่มี coverage threshold บังคับ

## Deploy

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name vtuberthai-ranking --branch main
```

## URL หลัก

| หน้า | URL |
|------|-----|
| Frontend | https://vtuberthai-ranking.pages.dev |
| Admin | https://vtuberthai-ranking.pages.dev/admin |
| API | https://vtuberthai-ranking.pages.dev/api/v1/ |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/rankings/` | GET | ดึงอันดับตามเงื่อนไข |
| `/api/v1/vtubers/` | GET | ค้นหา/กรอง VTuber |
| `/api/v1/vtubers/{slug}/` | GET | ข้อมูล VTuber รายคน |
| `/api/v1/vtubers/{slug}/history/` | GET | ประวัติสถิติสำหรับกราฟ |
| `/api/v1/compare/` | POST | เปรียบเทียบ VTuber 2-3 คน |
| `/api/v1/summary/` | GET | สรุปข้อมูลสำหรับหน้าหลัก |
| `/api/v1/auth/*` | POST/GET | login/logout/me (session cookie) |
| `/api/v1/admin/*` | GET/POST/PUT | จัดการช่อง, อันดับ, รายงาน, ผู้ใช้ (ต้อง login) |

## โครงสร้างโปรเจกต์

ดูภาพรวมสถาปัตยกรรม โครงสร้างไฟล์ การไหลของข้อมูล และแผนจัดเก็บ Vitest/Cypress ฉบับเต็มได้ที่ [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)

```
VtuberTHRanking/
├── frontend/
│   ├── functions/api/[[path]].js  # Pages Functions API (Hono)
│   ├── server/                    # auth.js, admin.js, password.js, admin-domain.js
│   ├── migrations/                # D1 schema
│   └── src/
│       ├── admin/                 # หน้า /admin (channels, rankings, users, …)
│       └── pages/                 # Home, Profile, Compare, Search
└── worker/
    └── updater.js                 # cron ดึงสถิติ YouTube ตามรอบใน settings
```
