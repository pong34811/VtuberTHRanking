# วิธีคำนวณอันดับ

ปรับตาม frontend/server/admin.js และ admin-domain.js เมื่อ 18 กันยายน 2026

## คะแนนและช่วงเวลา

| หมวด | ค่าจาก snapshot |
|---|---|
| followers | followers |
| views | total_views |
| videos | video_count |

Monthly ใช้ snapshot ล่าสุดก่อนต้นเดือนถัดไป จึงอาจใช้ข้อมูลเดือนก่อนเมื่อไม่มี snapshot ใหม่ ส่วน alltime ใช้ snapshot ล่าสุดทั้งหมดและเก็บ month เป็น NULL

เลือกช่อง is_active=1 ที่มี snapshot เรียง snapshot ด้วย julianday(recorded_at) DESC และ id DESC

## เผยแพร่อันดับ

manager เรียก POST /api/v1/admin/rankings/calculate พร้อม period, category และ month สำหรับ monthly

1. ตรวจ input และสิทธิ์
2. เลือก snapshot หากเกิน 90 ช่องส่ง 409 โดยไม่บันทึก
3. อ่านอันดับเดือนก่อน หรืออันดับ alltime ชุดเดิม
4. เรียงคะแนนมากไปน้อย ใช้ vtuber_id น้อยไปมากเมื่อคะแนนเท่ากัน
5. ให้คะแนนเท่ากันมีอันดับเดียวกัน เช่น 1, 1, 3
6. rank_change = อันดับเดิม − อันดับใหม่
7. D1 batch ลบชุดอันดับตามเงื่อนไข เพิ่มผลใหม่ และเก็บ audit log

ค่า +2 หมายถึงขึ้นสองอันดับ; -2 หมายถึงลงสองอันดับ ปัจจุบันตัวคำนวณคืน 0 ทั้งเมื่ออันดับคงเดิมและไม่มีอันดับเดิม ส่วน ChangeIndicator รองรับ NEW ผ่าน isNew หรือค่า 'NEW' แต่ null แสดงขีด จึงยังต้องปรับสัญญาข้อมูลนี้

## อ่านอันดับ

Rankings API แบ่งหน้าด้วย limit/offset ลิงก์ next/previous เก็บเดือน หมวด และขนาดหน้าไว้ครบ

Profile API คืนอันดับ active ของเดือนปัจจุบันตามเวลาไทย (UTC+7) และ alltime เท่านั้น ไม่ใช้อันดับเดือนเก่าทดแทน หน้าโปรไฟล์แสดง “ยังไม่มีอันดับ” เมื่อข้อมูลขาด

Public API และ admin ใช้ตัวช่วย currentMonth ร่วมกันจาก frontend/server/ranking-period.js เพื่อเปลี่ยนเดือนพร้อมกันตอนเที่ยงคืนเวลาไทย

## รอบดึงข้อมูล

worker/wrangler.toml ตั้ง cron ทุกต้นชั่วโมง Worker ตรวจ ranking_update_frequency ก่อนดึง:

| ค่า | ระยะ |
|---|---|
| manual | ข้าม |
| hourly | 1 ชั่วโมง |
| daily | 24 ชั่วโมง |
| weekly | 7 วัน |
| monthly | 30 วัน |

Worker ดึงสถิติช่อง YouTube ที่พร้อมใช้งาน บันทึก snapshots แล้วคำนวณอันดับทั้งรายเดือนและตลอดกาล หาก YouTube API ของช่องที่เริ่มดึงล้มเหลว Worker เก็บ errors และยังไม่บันทึก snapshots หรือเผยแพร่อันดับของรอบนั้น ยังไม่มี retry loop ภายในรอบ

## งานต่อไป

กำหนด NEW, รองรับเกิน 90 ช่อง และเพิ่มนโยบาย retry สำหรับการดึงข้อมูลที่ล้มเหลว
