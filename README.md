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
npm run build
npm run db:migrate:local
npm run dev:api      # Pages Functions + D1 ในเครื่อง ที่ http://127.0.0.1:8788
```

ก่อนเริ่ม API ให้คัดลอก `frontend/.dev.vars.example` เป็น `frontend/.dev.vars` และเปลี่ยน `ADMIN_SETUP_TOKEN` เป็นรหัสส่วนตัว ไฟล์นี้ไม่ถูกเก็บใน Git

เปิดอีก terminal แล้วรัน `cd frontend` และ `npm run dev` เพื่อเปิดเว็บที่ http://127.0.0.1:5173 โดย Vite ส่ง `/api` ไปยัง API ในเครื่อง ข้อมูล D1 เก็บใน `frontend/.wrangler/state` และแยกจาก production เมื่อเปิด `/admin` ครั้งแรก ระบบจะแสดงฟอร์มสร้างผู้ดูแลโดยใช้รหัสตั้งค่าข้างต้นและรหัสผ่านอย่างน้อย 12 ตัวอักษร

ต้องใช้ Node.js `>=22.12.0` สำหรับ Vite, Vitest และ Wrangler (ไฟล์ `.nvmrc` ใช้ Node.js 22.12.0)

คำสั่งตรวจสอบชุดทดสอบ (รันจากโฟลเดอร์ `frontend/`):

```bash
npm test                 # Vitest ทั้งหมด
npm run test:unit        # unit tests
npm run test:integration # integration tests
npm run test:coverage    # ทดสอบพร้อมรายงาน coverage
npm run test:e2e         # Cypress E2E (ต้องรัน dev server ก่อน)
```

ตรวจเมื่อ 25 กันยายน 2026: Vitest 270 tests ผ่านใน 20 files, production build ผ่าน และตรวจ setup/login, CSRF, การซ่อนช่องที่ปิดใช้งาน และ migrations กับ API/D1 ในเครื่องแล้ว Cypress ใช้ API stubs และไม่ได้รันซ้ำในรอบนี้ ยังไม่มี coverage threshold บังคับ

เอกสารพัฒนา: [ข้อกำหนดผลิตภัณฑ์](docs/PRD.md), [ฐานข้อมูล D1](docs/DATABASE.md), [API](docs/API_SPEC.md), [วิธีคำนวณอันดับ](docs/RANKING_ALGORITHM.md)

## Deploy

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name vtuberthai-ranking --branch main
```

ก่อน deploy ให้ใช้ D1 migrations ให้ครบ และตั้ง `ADMIN_SETUP_TOKEN` เป็น secret ใน Cloudflare Pages สำหรับการสร้างผู้ดูแลครั้งแรก หากไม่มี secret นี้ API จะปฏิเสธการตั้งค่าด้วย 503

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
