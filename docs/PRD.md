# ข้อกำหนดผลิตภัณฑ์ VTuber Thai Ranking

ปรับตามโค้ดเมื่อ 24 กันยายน 2026

## เป้าหมายและเทคโนโลยี

รวบรวมสถิติ VTuber ไทยจาก YouTube เพื่อจัดอันดับ ค้นหา และดูประวัติ ข้อมูลอัปเดตตามรอบ ไม่ใช่ real-time

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| กราฟ / HTTP | Recharts 3 / Axios |
| API | Hono บน Cloudflare Pages Functions |
| ฐานข้อมูล | Cloudflare D1 (SQLite), binding DB |
| งานตามเวลา | Cloudflare Worker vtuberthai-updater |
| ทดสอบ | Vitest, Testing Library, Cypress |

เวอร์ชันจริงอ้างอิง frontend/package-lock.json และ configuration ใน frontend/wrangler.toml กับ worker/wrangler.toml

## ฟีเจอร์ปัจจุบัน

- อันดับรายเดือนและทั้งหมด แยกผู้ติดตาม ยอดวิว จำนวนคลิป
- หน้าแรกสำหรับค้นพบ VTuber จากชื่อ หมวดหมู่ และวันที่เพิ่มเข้ารายการ; ตัวเลือก layout มาจากข้อมูลช่อง metadata
- หน้า `/stats` สำหรับตารางอันดับ ตัวกรอง วิธีจัดอันดับ และวันที่ snapshot ล่าสุด
- ค้นหาชื่อ กรองประเภทเนื้อหา และสังกัด indie/agency
- โปรไฟล์ ข้อมูลช่อง สถิติล่าสุด อันดับปัจจุบัน และกราฟย้อนหลัง
- API `/compare/` ยังคงรองรับการเปรียบเทียบสำหรับ integration; ไม่มีหน้าเปรียบเทียบใน public UI
- Admin จัดการช่อง สังกัด snapshots หมวดหมู่ อันดับ รายงาน CSV ผู้ใช้ ประวัติ และตั้งค่า
- Session cookie, CSRF และสิทธิ์ manager/staff ตาม [AUTH](../frontend/AUTH.md)
- รองรับมือถือและเลือกธีม

## การไหลของข้อมูล

YouTube Data API → Updater Worker → D1 stats_snapshots

Admin คำนวณอันดับ → Hono → D1 rankings → Public API → React

หน้า Home อ่าน `/homepage-config/` และ `/directory/`; หน้า Stats อ่าน `/summary/` และ `/rankings/`. หน้า Home ใช้ metadata ช่องสำหรับการค้นพบและไม่นำสถิติอันดับมาเรียงหรือคัดช่อง

Worker ถูกเรียกทุกต้นชั่วโมงด้วย cron 0 * * * * แล้วตรวจ ranking_update_frequency และ snapshot ล่าสุดก่อนดึงจริง ค่า manual จะข้าม และ monthly หมายถึง 30 วัน

การดึงสถิติไม่คำนวณอันดับอัตโนมัติ manager ต้องเรียกผ่าน admin ปัจจุบันจำกัด 90 ช่องต่อ batch ส่วน Twitch เก็บลิงก์ได้แต่ updater ดึงเฉพาะ YouTube

## งานคงเหลือ

- ตัวกรองช่วงผู้ติดตามและเรียงผลค้นหาเพิ่มเติม
- ทำสถานะ NEW ให้สอดคล้องกับ rank_change
- กำหนดการคำนวณอันดับหลัง sync และรองรับเกิน 90 ช่อง
- ขยาย Cypress, เพิ่ม CI และ smoke test บน API/ฐานข้อมูลทดสอบจริง
- ตรวจ admin หลัง login และ responsive/accessibility เพิ่มเติม

สมาชิก รายการโปรด แจ้งเตือน ข่าว Hall of Fame และหลายภาษาเป็นฟีเจอร์อนาคต

## เอกสารพัฒนา

[README](../README.md), [PROJECT_STRUCTURE](PROJECT_STRUCTURE.md), [DATABASE](DATABASE.md), [API_SPEC](API_SPEC.md), [RANKING_ALGORITHM](RANKING_ALGORITHM.md)

Dev server ปัจจุบัน proxy API ไป production; ชุดทดสอบใช้ mock/stub
