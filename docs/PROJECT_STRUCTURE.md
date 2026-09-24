# ภาพรวมโครงสร้างโปรเจกต์ VTuberTHRanking

เอกสารนี้อธิบายองค์ประกอบของระบบ เส้นทางการไหลของข้อมูล และตำแหน่งจัดเก็บชุดทดสอบ โดยแยกโครงสร้างที่มีอยู่จริงออกจากโครงสร้างเป้าหมายสำหรับ Vitest และ Cypress อย่างชัดเจน

## 1 ภาพรวมระบบ

VTuberTHRanking เป็นเว็บจัดอันดับ VTuber ไทยที่ประกอบด้วย React frontend, Cloudflare Pages Functions API, Cloudflare D1 และ Cloudflare Worker สำหรับดึงสถิติจาก YouTube ตามรอบเวลา

```text
ผู้ใช้งาน
   |
   v
React frontend
   |
   | HTTP /api/v1
   v
Cloudflare Pages Functions และ Hono
   |
   +--------------------+
   |                    |
   v                    v
Cloudflare D1      YouTube Data API
   ^                    |
   |                    |
   +--- Updater Worker -+
```

ส่วน public ใช้แสดงหน้า discovery สถิติ ค้นหา และโปรไฟล์ VTuber ส่วน admin ใช้จัดการช่อง สถิติ อันดับ รายงาน การตั้งค่า และผู้ใช้งาน โดยมี session cookie และ CSRF token ป้องกันคำขอที่เปลี่ยนข้อมูล

## 2 เทคโนโลยีหลัก

| ส่วน | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Web UI | React 19, React Router, Tailwind CSS | แสดงหน้า public และ admin |
| Build | Vite 8 | พัฒนาและ build frontend |
| API | Hono บน Cloudflare Pages Functions | ให้บริการ public API, authentication และ admin API |
| Database | Cloudflare D1 | เก็บ VTuber, snapshots, rankings, users และข้อมูลระบบ |
| Background job | Cloudflare Worker | ดึงสถิติช่องจาก YouTube Data API |
| Unit and integration test | Vitest | ทดสอบ business rules, API และ React components |
| End to end test | Cypress | ทดสอบ user journey ผ่าน browser |

## 3 โครงสร้างปัจจุบัน

```text
VtuberTHRanking/
├── .claude/                         # การตั้งค่าหรือคำสั่งช่วยงานภายในโปรเจกต์
├── docs/
│   ├── API_SPEC.md                  # ข้อกำหนด API
│   ├── DATABASE.md                  # โครงสร้างฐานข้อมูล
│   ├── PRD.md                       # ข้อกำหนดผลิตภัณฑ์
│   ├── RANKING_ALGORITHM.md         # หลักการคำนวณอันดับ
│   ├── PROJECT_STRUCTURE.md         # เอกสารภาพรวมฉบับนี้
│   └── superpowers/plans/           # แผนการพัฒนาที่จัดทำไว้ก่อนหน้า
├── frontend/
│   ├── functions/
│   │   └── api/
│   │       └── [[path]].js          # จุดรับ Pages Functions (mount auth/admin/public routers)
│   ├── migrations/
│   │   ├── 0001_existing_schema.sql # ตารางหลักของระบบ
│   │   ├── 0002_admin.sql           # ตารางและฟิลด์สำหรับระบบ admin
│   │   ├── 0003_videos_category.sql # เพิ่มหมวดจำนวนวิดีโอ
│   │   ├── 0004_channel_notes.sql   # notes ภายใน
│   │   └── 0005_agencies.sql        # สังกัดและ agency_id
│   ├── server/
│   │   ├── admin-domain.js          # validation และกฎธุรกิจของ admin
│   │   ├── admin.js                 # admin routes และ database operations
│   │   ├── auth.js                  # setup, login, logout และ session
│   │   ├── password.js              # validate, hash และ verify password
│   │   ├── directory.js             # public profile metadata directory
│   │   └── public.js                # public API routes (config, rankings, vtubers, compare, summary)
│   ├── src/
│   │   ├── admin/
│   │   │   ├── components/ui/       # UI primitives เฉพาะส่วน admin
│   │   │   ├── AdminPage.jsx        # layout และ routing ของ admin
│   │   │   ├── AuthScreen.jsx       # หน้า setup และ login
│   │   │   ├── ChannelsTab.jsx      # console รายการช่อง (shell)
│   │   │   ├── RankingsTab.jsx      # คำนวณและดูอันดับ
│   │   │   ├── channels/            # feature modules ของ console ช่อง
│   │   │   │   ├── ChannelForm.jsx  # ฟอร์มเพิ่ม/แก้ไขช่อง
│   │   │   │   ├── Snapshots.jsx    # ประวัติและบันทึกสถิติ
│   │   │   │   ├── YouTubeImport.jsx # นำเข้าช่องจาก YouTube
│   │   │   │   └── options.js       # ค่าเริ่มต้นและตัวเลือกฟิลด์ช่อง
│   │   │   ├── tabs/                # feature modules ของ management tabs
│   │   │   │   ├── AuditTab.jsx     # ประวัติการทำงาน
│   │   │   │   ├── CategoriesTab.jsx # จัดการหมวดหมู่
│   │   │   │   ├── ReportsTab.jsx   # สร้าง/ดาวน์โหลดรายงาน
│   │   │   │   ├── HomepageTemplateTab.jsx # เลือก/preview/publish discovery layout
│   │   │   │   ├── SettingsTab.jsx  # ตั้งค่าเว็บไซต์
│   │   │   │   ├── UsersTab.jsx     # จัดการผู้ใช้
│   │   │   │   └── useList.js       # shared hook โหลดรายการ
│   │   │   ├── api.js               # client สำหรับ auth และ admin API
│   │   │   ├── admin.css            # style ของ admin
│   │   │   └── ui.jsx               # shared admin UI และ helper hooks
│   │   ├── api/
│   │   │   └── client.js            # Axios client สำหรับ public API
│   │   ├── components/
│   │   │   ├── ui/                  # reusable UI primitives
│   │   │   ├── CategorySelector.jsx
│   │   │   ├── ChangeIndicator.jsx
│   │   │   ├── Feedback.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── LeaderboardTable.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── PeriodSelector.jsx
│   │   │   ├── RankBadge.jsx
│   │   │   ├── ThemeSelector.jsx
│   │   │   ├── TopThree.jsx
│   │   │   ├── TrendChart.jsx
│   │   │   └── VTuberCard.jsx
│   │   ├── lib/
│   │   │   └── utils.js             # utility สำหรับรวม class names
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # หน้า discovery และโหลด public template config
│   │   │   ├── StatsPage.jsx        # หน้าอันดับ สรุปสถิติ และ methodology
│   │   │   ├── homepageTemplates.js # รายละเอียดตัวเลือก homepage ที่ publish ได้
│   │   │   ├── searchParams.js      # URL helpers สำหรับ query/filter ของ directory
│   │   │   └── discovery/           # renderer, metadata hook, creator cards และ CSS
│   │   │   ├── ProfilePage.jsx      # หน้าโปรไฟล์และกราฟย้อนหลัง
│   │   │   └── SearchPage.jsx       # หน้าค้นหาและกรอง VTuber
│   │   ├── App.jsx                  # route หลักของแอป
│   │   ├── index.css                # global styles
│   │   └── main.jsx                 # React entry point
│   ├── tests/
│   │   ├── setup/node.js             # setup สำหรับโปรเจกต์ node
│   │   ├── helpers/d1.js             # helper สำหรับ D1 mock
│   │   ├── unit/server/              # password และ admin-domain tests
│   │   ├── unit/worker/              # updater tests
│   │   └── integration/              # auth และ admin API tests
│   ├── AUTH.md                       # เอกสารระบบ authentication
│   ├── components.json              # การตั้งค่า UI components
│   ├── Dockerfile                   # image สำหรับ deployment
│   ├── index.html                   # HTML entry point
│   ├── jsconfig.json                # JavaScript path configuration
│   ├── package.json                 # dependencies และ scripts
│   ├── vite.config.js               # Vite, alias และ dev proxy
│   ├── vitest.config.js             # การตั้งค่า Vitest ปัจจุบัน
│   └── wrangler.toml                # Pages และ D1 binding
├── worker/
│   ├── updater.js                   # cron และ manual updater สำหรับ YouTube stats
│   └── wrangler.toml                # Worker, schedule และ D1 binding
├── .gitignore
└── README.md
```

โฟลเดอร์ `node_modules`, `dist`, `.vite`, `.wrangler` และไฟล์ `.env` เป็นไฟล์ที่สร้างในเครื่องหรือมีข้อมูลเฉพาะ environment จึงไม่ควรเก็บใน Git

## 4 เส้นทางการทำงานของระบบ

### 4.1 Public website

```text
Home       Stats       Search Profile Compare
          |
          v
src/api/client.js
          |
          v
/api/v1/homepage-config
/api/v1/directory
/api/v1/rankings
/api/v1/vtubers
/api/v1/compare
                  /api/v1/summary (Stats)
          |
          v
Cloudflare D1
```

`App.jsx` กำหนดเส้นทาง `/`, `/stats`, `/search`, `/profile/:slug` และ `/admin/*`. เส้นทางเก่าที่ไม่รองรับ เช่น `/compare` จะแสดงหน้าไม่พบข้อมูล. หน้า Home โหลด layout จาก `/homepage-config/` และ metadata จาก `/directory/`; หน้า Stats ใช้ rankings/summary ส่วนหน้า Search ใช้ `/vtubers/` และยังรองรับ query-prefill. หน้า public เรียก API ผ่าน Axios client ส่วน Vite development server จะ proxy `/api` ไปยังระบบที่ตั้งค่าไว้

### 4.2 Admin website

```text
AdminPage
   |
   +-- AuthScreen ------> /api/v1/auth
   |
   +-- ChannelsTab -----> /api/v1/admin/vtubers
   |
   +-- RankingsTab -----> /api/v1/admin/rankings
   |
   +-- ManagementTabs --> reports settings users audit logs
                              |
                              v
                         requireUser
                              |
                              v
                        Cloudflare D1
```

คำขอ admin ต้องผ่าน `requireUser` การเข้าสู่ระบบจะสร้าง session cookie และคืน CSRF token คำขอที่แก้ไขข้อมูลต้องส่ง token นี้กลับใน `X-CSRF-Token`

### 4.3 YouTube updater

```text
Cloudflare cron หรือ manual request
              |
              v
worker/updater.js
              |
              +--> อ่านช่องที่ active จาก D1
              +--> เรียก YouTube Data API
              +--> บันทึก stats_snapshots ลง D1
```

รอบการอัปเดตอ่านจาก `ranking_update_frequency` และรองรับ manual, hourly, daily, weekly และ monthly

## 5 สถานะการทดสอบปัจจุบัน

- มี Cypress 16 พร้อม configuration, fixtures, custom commands และ E2E specs สำหรับ public/admin journeys
- มี Vitest configuration ที่แบ่งเป็นโปรเจกต์ `node` และ `components` โดยโปรเจกต์ `components` รองรับ automatic JSX transform และ alias `@` เช่นเดียวกับ application
- Vitest แบ่ง project เป็น `node` และ `components` ครอบคลุม server, worker, React pages/components และ auth/admin/public API; รันผลปัจจุบันด้วย `npm test`
- ตรวจเมื่อ 24 กันยายน 2026: Cypress 4 specs ที่เกี่ยวกับ Home/Stats/Search และ Admin homepage template ผ่าน 19 E2E tests แบบ headless โดย stub API ผ่าน `cy.intercept` ไม่พึ่ง production backend — รันด้วย `npm run test:e2e -- --spec "cypress/e2e/public/home.cy.js,cypress/e2e/public/stats.cy.js,cypress/e2e/public/search.cy.js,cypress/e2e/admin/homepage-template.cy.js"`
- ชุดปัจจุบันทดสอบ authentication บางกรณี การบังคับ login, password, admin domain helpers, updater worker บางส่วน, การแสดงผล `RankBadge`, public API (`homepage-config`, `directory`, `rankings`, `vtubers`, `compare` และ `summary`), admin channels CRUD/snapshots, YouTube import ทุก branch และ admin tabs/channels
- ยังต้องขยาย updater coverage และ API client; public pages มี component tests บางพฤติกรรมแล้ว
- ต้องใช้ Node.js `^20.19.0 || >=22.12.0` ตามข้อกำหนดของ Vite และ Vitest โดย `.nvmrc` กำหนดเวอร์ชัน 20.19.0
- `npm run test:coverage` สร้างรายงาน coverage ได้แล้ว แต่ยังไม่กำหนด threshold จนกว่าจะมี backend และ frontend suites ครบถ้วน
- ตัวเลข coverage เดิมไม่ใช่ผลยืนยันของโค้ดล่าสุด ต้องรัน `npm run test:coverage` เพื่อสร้างรายงานใหม่

## 6 โครงสร้างการทดสอบเป้าหมาย

โครงสร้างนี้เป็นแบบที่จะเพิ่มในขั้น implementation ยังไม่ได้มีอยู่จริงทั้งหมดใน repository ณ วันที่เขียนเอกสาร

```text
frontend/
├── cypress.config.js
├── cypress/
│   ├── e2e/
│   │   ├── public/
│   │   │   ├── home.cy.js
│   │   │   ├── search.cy.js
│   │   │   ├── profile.cy.js
│   │   │   └── compare.cy.js
│   │   └── admin/
│   │       ├── authentication.cy.js
│   │       ├── channels.cy.js
│   │       ├── rankings.cy.js
│   │       ├── reports.cy.js
│   │       ├── settings.cy.js
│   │       └── users.cy.js
│   ├── fixtures/
│   │   ├── admin-user.json
│   │   ├── rankings.json
│   │   └── vtubers.json
│   ├── support/
│   │   ├── commands.js
│   │   └── e2e.js
│   ├── downloads/
│   │   └── .gitkeep
│   └── README.md
├── tests/
│   ├── setup/
│   │   └── vitest.setup.js
│   ├── helpers/
│   │   ├── d1.js
│   │   └── requests.js
│   ├── unit/
│   │   ├── server/
│   │   │   ├── admin-domain.test.js
│   │   │   ├── auth.test.js
│   │   │   └── password.test.js
│   │   ├── worker/
│   │   │   └── updater.test.js
│   │   └── components/
│   │       ├── selectors.test.jsx
│   │       ├── ranking-components.test.jsx
│   │       └── admin-ui.test.jsx
│   └── integration/
│       ├── public-api.test.js
│       ├── admin-api.test.js
│       └── api-client.test.js
└── package.json
```

### 6.1 ขอบเขต Vitest

Vitest รับผิดชอบการทดสอบที่เร็วและแยกจาก browser จริง ได้แก่

- validation, date handling, ranking calculation และ CSV safety
- password hashing, session, origin และ CSRF rules
- public และ admin API response, status code และ database interaction
- updater scheduling, YouTube response, skipped channels และ error collection
- API client URL, parameters, error handling และ report download
- React components และ hooks ที่มี business behavior
- loading, empty, success และ error states ของหน้าหลัก

UI primitive จาก library จะไม่ถูกทดสอบซ้ำทุกไฟล์ หากไม่มี behavior ของโปรเจกต์เพิ่มเข้ามา

### 6.2 ขอบเขต Cypress

Cypress รับผิดชอบการทดสอบ user journey ผ่าน browser ได้แก่

| กลุ่ม | Journey หลัก |
|---|---|
| Public home | เปิดเว็บ โหลดอันดับ เปลี่ยนช่วงเวลาและหมวด |
| Search | ค้นหา กรอง เปิดโปรไฟล์ และจัดการผลลัพธ์ว่าง |
| Profile | แสดงข้อมูลล่าสุด อันดับ และประวัติกราฟ |
| Authentication | setup, login, session restore, logout และ unauthorized state |
| Channels | สร้าง แก้ไข ดู snapshot และ import YouTube |
| Rankings | เลือกเงื่อนไข คำนวณอันดับ และตรวจผลลัพธ์ |
| Reports | สร้างรายการและดาวน์โหลด CSV |
| Settings | โหลดและบันทึกค่าระบบ |
| Users | สร้างและแก้ไขผู้ใช้ รวมข้อจำกัดสิทธิ์ manager |

หมายเหตุ: API `/compare/` ยังอยู่เพื่อรองรับ integration แต่ public UI ไม่มีหน้าเปรียบเทียบแล้ว

## 7 หลักการจัดเก็บ Cypress

- แยก `public` และ `admin` ตามขอบเขตผู้ใช้
- หนึ่ง spec ครอบคลุมหนึ่ง feature หรือ user journey ไม่รวมทุกอย่างไว้ในไฟล์เดียว
- เก็บข้อมูลคงที่ใน `fixtures` และไม่ใส่ credential จริง
- เก็บ reusable browser actions เช่น login หรือ seed data ใน `support/commands.js`
- ใช้ API interception เฉพาะเมื่อทดสอบสถานะ UI แบบ deterministic
- มีอย่างน้อยหนึ่งเส้นทาง smoke test ที่เชื่อม browser, API และ test database จริง
- ไม่ commit screenshots, videos และ downloads ที่เกิดจาก test run
- ใช้ selector ที่เสถียร เช่น role, accessible name หรือ `data-cy` เฉพาะจุดที่จำเป็น

## 8 Test data และ isolation

ชุดทดสอบต้องไม่เปลี่ยนข้อมูล production โดยตรง การทดสอบควรใช้ environment และ D1 database สำหรับ test โดยเฉพาะ

```text
เริ่ม test run
   |
   +--> สร้างหรือ reset test database
   +--> รัน migrations ตามลำดับ
   +--> seed ข้อมูลขั้นต่ำ
   +--> รัน Vitest หรือ Cypress
   +--> ล้างข้อมูลหรือทิ้ง database ชั่วคราว
```

ข้อมูล login สำหรับ E2E ควรมาจาก environment variables เช่น `CYPRESS_ADMIN_USERNAME` และ `CYPRESS_ADMIN_PASSWORD` โดยมีไฟล์ `.env.example` อธิบายชื่อค่าที่ต้องตั้ง แต่ไม่บันทึกรหัสผ่านจริงลง Git

## 9 คำสั่งทดสอบ

รันจากโฟลเดอร์ `frontend/` ด้วย Node.js `^20.19.0 || >=22.12.0` (`.nvmrc` ใช้ 20.19.0):

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

คำสั่งเหล่านี้มีใน `frontend/package.json` แล้ว รวมถึง `npm run test:e2e` สำหรับ Cypress ซึ่งต้องรัน dev server ก่อน

## 10 สิ่งที่ต้องเพิ่มก่อนถือว่าระบบทดสอบพร้อม

1. แยกและขยาย test ให้ครอบคลุม public API, API client และ component behavior
2. เพิ่ม D1 mock หรือ test database helper ที่ให้ผลลัพธ์สม่ำเสมอสำหรับชุด integration ที่กว้างขึ้น
3. ขยาย Cypress specs สำหรับ profile และ admin journeys ที่เหลือจาก configuration, fixtures และ commands ที่มีแล้ว
4. ตั้ง CI ให้รัน build, Vitest และ Cypress โดยไม่แตะ production data
5. เก็บ test artifacts จาก CI เฉพาะเมื่อทดสอบล้มเหลวเพื่อช่วยวิเคราะห์ปัญหา

## 11 เกณฑ์ส่งมอบ

ระบบทดสอบจะถือว่าพร้อมเมื่อ build สำเร็จ, Vitest ทุกชุดผ่าน, Cypress journeys สำคัญผ่านบน test environment, ไม่มี secret ใน repository และเอกสารคำสั่งรันตรงกับ configuration จริง
