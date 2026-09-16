# Frontend Feature Decomposition Implementation Plan

**Goal:** แยก `ChannelsTab.jsx` (675 บรรทัด) และ `ManagementTabs.jsx` (566 บรรทัด) เป็น feature modules เล็กที่ review ได้ พร้อม smoke tests โดยพฤติกรรมและหน้าตาเหมือนเดิมทุกประการ

**Architecture:** คงสอง UI layers ไว้ตามเดิม (`src/admin/ui.jsx` สำหรับ legacy tabs, `src/admin/components/ui/*` สำหรับ ChannelsTab) ไม่ migrate ข้าม layer เพราะเปลี่ยน visuals โดยไม่มี E2E คุม งานนี้ย้าย code แบบ verbatim เท่านั้น

**Tech Stack:** Node.js `^20.19.0 || >=22.12.0`, React 19, Vitest 3 + jsdom + Testing Library

**Spec:** `docs/PROJECT_STRUCTURE.md`

## Global Constraints

- ห้ามเปลี่ยน logic, JSX, CSS classes, props หรือ response handling — ย้าย code อย่างเดียว
- ไม่ migrate legacy tabs (`ui.jsx` primitives) ไป shadcn adapters ในระยะนี้
- Tests ตรวจ observable render output (headings, empty/loading states) ไม่ตรวจ implementation detail
- ไม่ commit credentials, `.env`, screenshots, videos หรือ generated downloads

---

### Task 1 Split management tabs into feature modules

**Files:**
- Create: `frontend/src/admin/tabs/useList.js`
- Create: `frontend/src/admin/tabs/CategoriesTab.jsx` (CategoriesTab + CategoryForm)
- Create: `frontend/src/admin/tabs/ReportsTab.jsx`
- Create: `frontend/src/admin/tabs/UsersTab.jsx` (UsersTab + QuickDisable + UserForm + blankUser)
- Create: `frontend/src/admin/tabs/AuditTab.jsx`
- Create: `frontend/src/admin/tabs/SettingsTab.jsx`
- Delete: `frontend/src/admin/ManagementTabs.jsx`
- Modify: `frontend/src/admin/AdminPage.jsx` (เปลี่ยน import จาก `./ManagementTabs` เป็น `./tabs/...`)
- Create: `frontend/tests/unit/components/admin-tabs.test.jsx`

**Interfaces:**
- Consumes: `adminApi`/`downloadReport` จาก `../api`, primitives จาก `../ui`, `csrfToken`/`currentUser` props
- Produces: named exports `CategoriesTab`, `ReportsTab`, `UsersTab`, `AuditTab`, `SettingsTab` ตัวเดิม `AdminPage` ใช้ได้โดยไม่เปลี่ยน props

- [ ] **Step 1: Write failing smoke tests for the tab modules**

Create `frontend/tests/unit/components/admin-tabs.test.jsx` mock `global.fetch` ให้ตอบ `{ results: [] }` แล้ว render แต่ละ tab ตรวจ loading/empty output:

```js
expect(await screen.findByText('หมวดหมู่อันดับ')).toBeInTheDocument();
```

- CategoriesTab แสดงหัวข้อ `หมวดหมู่อันดับ`
- ReportsTab แสดงหัวข้อ `รายงาน`
- UsersTab แสดงหัวข้อ `ผู้ใช้งาน` (ส่ง `currentUser={{ id: 1 }}`)
- AuditTab แสดงหัวข้อ `ประวัติการทำงาน`
- SettingsTab แสดง label `ชื่อเว็บไซต์`

- [ ] **Step 2: Run the tab tests and verify RED**

```powershell
npm run test:unit -- tests/unit/components/admin-tabs.test.jsx
```

Expected: FAIL เพราะ `src/admin/tabs/*` ยังไม่มี

- [ ] **Step 3: Move each tab verbatim to its own module**

ย้าย `useList` ไป `tabs/useList.js` แล้วให้ทั้ง 4 tabs ที่ใช้ import จากที่ใหม่ ย้ายแต่ละ tab พร้อม subcomponents แบบ verbatim ลบ `ManagementTabs.jsx` อัปเดต import ใน `AdminPage.jsx`

- [ ] **Step 4: Run tab tests and verify GREEN**

```powershell
npm run test:unit -- tests/unit/components/admin-tabs.test.jsx
npm test
```

Expected: tab tests และ suite เดิมผ่านทั้งหมด

### Task 2 Split the channels console into feature modules

**Files:**
- Create: `frontend/src/admin/channels/options.js` (`blank`, `platforms`, `categories`, `affiliations`)
- Create: `frontend/src/admin/channels/ChannelForm.jsx` (`ChannelForm` + `FormSection`)
- Create: `frontend/src/admin/channels/YouTubeImport.jsx`
- Create: `frontend/src/admin/channels/Snapshots.jsx`
- Modify: `frontend/src/admin/ChannelsTab.jsx` (เหลือ shell: list console + dialogs wiring)
- Modify: `frontend/tests/unit/components/admin-tabs.test.jsx` (เพิ่ม smoke tests)

**Interfaces:**
- Consumes: `adminApi` จาก `../api`, `useSubmit`/`fmt*` จาก `../ui`, shadcn adapters จาก `../components/ui/*`
- Produces: `ChannelForm`, `YouTubeImport`, `Snapshots` รับ props เดิม (`value`/`channel`, `csrfToken`, `onClose`, `onSaved`)

- [ ] **Step 1: Extend smoke tests for the channel modules**

เพิ่มใน `admin-tabs.test.jsx` (ยัง RED เพราะ modules ยังไม่มี):

```js
expect(await screen.findByText('ยังไม่มีสถิติ')).toBeInTheDocument();
```

- ChannelForm render ด้วย `value={{...blank-like}}` แสดง label `ชื่อช่อง`
- YouTubeImport แสดง label `Channel ID / @handle / ลิงก์`
- Snapshots (mock fetch `{ results: [] }`) แสดง `ยังไม่มีสถิติ`

- [ ] **Step 2: Move each channel module verbatim**

ย้าย constants ไป `options.js` ย้ายแต่ละ component พร้อม imports ที่ต้องใช้แบบ verbatim `ChannelsTab.jsx` เหลือ shell เดิม (state, toolbar, table, dialogs)

- [ ] **Step 3: Run the complete verification set**

```powershell
npm test
npm run test:coverage
npm run build
```

Expected: ทุกคำสั่ง exit 0 รวม smoke tests ใหม่ ไม่มี regression

- [ ] **Step 4: Update project documentation**

แก้ `docs/PROJECT_STRUCTURE.md`: โครง `src/admin/` ใหม่ (tabs/, channels/), อัปเดตจำนวน tests/coverage baseline ตามจริง

## Follow-up plans

1. `cypress-e2e` — add isolated test environment, Cypress configuration, fixtures, commands and public/admin journeys
