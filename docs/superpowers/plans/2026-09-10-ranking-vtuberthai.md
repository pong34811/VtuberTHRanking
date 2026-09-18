# แผนพัฒนา Ranking VTuber Thai

ปรับปรุงเมื่อ 18 กันยายน 2026 แผนตั้งต้นถูกแทนที่ด้วยสถาปัตยกรรมปัจจุบันและงานคงเหลือ

## สถาปัตยกรรมปัจจุบัน

React SPA บน Cloudflare Pages เรียก Hono ผ่าน Pages Functions ใช้ Cloudflare D1 และ Updater Worker ดึงสถิติ YouTube

## งานที่มีแล้ว

- Public pages: อันดับ ค้นหา โปรไฟล์ เปรียบเทียบ
- Hono API และระบบ session/CSRF
- D1 migrations สำหรับข้อมูลช่อง สถิติ อันดับ สังกัด และระบบผู้ดูแล
- Admin จัดการข้อมูล คำนวณอันดับ และรายงาน CSV
- Worker cron และ Vitest/Cypress พื้นฐาน

## งานคงเหลือ

1. ขยายความถูกต้องของ public API และการแสดงอันดับ
2. เพิ่ม Cypress โปรไฟล์ เปรียบเทียบ และ admin journeys
3. เพิ่ม CI และทดสอบ API กับ D1 local/test
4. รองรับอันดับเกิน 90 ช่อง กำหนด NEW และการคำนวณหลัง sync
5. ตรวจ responsive และ accessibility

## เอกสารพัฒนาต่อ

- [README](../../../README.md)
- [PRD](../../PRD.md)
- [PROJECT_STRUCTURE](../../PROJECT_STRUCTURE.md)
- [DATABASE](../../DATABASE.md)
- [API_SPEC](../../API_SPEC.md)
- [RANKING_ALGORITHM](../../RANKING_ALGORITHM.md)
