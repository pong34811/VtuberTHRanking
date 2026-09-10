# Product Requirements Document (PRD)
# เว็บไซต์จัดอันดับ VTuber Thai

---

## 1. ภาพรวมโปรเจกต์

เว็บไซต์จัดอันดับ VTuber ไทยที่รวบรวมข้อมูลสถิติจาก YouTube และแสดงผลอันดับแบบเรียลไทม์ พร้อมระบบติดตามการเปลี่ยนแปลงอันดับ

---

## 2. ฟีเจอร์หลัก

### 2.1 ระบบจัดอันดับ

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| ช่วงเวลา | รายเดือน / ทั้งหมด (All Time) |
| หมวดหมู่ | ยอดผู้ติดตาม (Followers) / ยอดวิว (Views) |
| เครื่องหมายเปลี่ยนแปลง | ลูกศร ↑ ขึ้น / ↓ ลง + จำนวนอันดับ |
| สัญลัษณ์พิเศษ | NEW (เข้ารายการครั้งแรก) / — (ไม่เปลี่ยน) |

### 2.2 หน้าเว็บหลัก

| หน้า | รายละเอียด |
|------|-----------|
| หน้าหลัก | Leaderboard Top 10 + ตัวเลือกช่วงเวลา/หมวด |
| โปรไฟล์ VTuber | ข้อมูลส่วนตัว + กราฟเทรนด์ + อันดับปัจจุบัน |
| เปรียบเทียบ | เลือก 2-3 VTuber เปรียบเทียบกราฟ |
| ค้นหา | ค้นหาตามชื่อ/แนวหน้า/สังกัด |

### 2.3 ระบบแสดงผล

- Dark Theme เป็นหลัก (เข้ากับวัฒนธรรม VTuber/Gaming)
- Responsive Design รองรับมือถือ
- สีลูกศร: เขียว(ขึ้น) / แดง(ลง) / เท่า(ไม่เปลี่ยน) / เหลือง(NEW)

---

## 3. เทคโนโลยีที่ใช้

### Backend
| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Django 5.x |
| API | Django REST Framework (DRF) |
| Task Queue | Celery + Redis |
| Database | PostgreSQL |
| Web Server | Django runserver |

### Frontend
| ส่วน | เทคโนโลยี |
|------|-----------|
| Build Tool | Vite 8.2.2 |
| Framework | React 19.2.8 |
| Styling | Tailwind CSS 4.3 |
| Routing | React Router 8.3.0 |
| Charts | Recharts 3.10.1 |
| HTTP Client | Axios 1.20.0 |

### DevOps
| ส่วน | เทคโนโลยี |
|------|-----------|
| Container | Docker + Docker Compose |

---

## 4. ข้อกำหนดระบบ

### 4.1 ข้อมูล VTuber ที่ต้องเก็บ
- ชื่อ (Display Name)
- Slug (สำหรับ URL)
- รูปโปรไฟล์
- คำอธิบาย (Bio)
- URL ช่อง YouTube / Twitch
- แนวหน้า (Gaming, Singing, Chatting, Art, etc.)
- สังกัด (Indie / Agency)
- ชื่อสังกัด (ถ้ามี)
- สถานะ (Active / Inactive)

### 4.2 สถิติที่ต้องเก็บ
- จำนวนผู้ติดตาม (Followers)
- ยอดวิวรวม (Total Views)
- ยอดวิวเฉลี่ยต่อวิดีโอ (Avg Views)
- วันเวลาที่บันทึก

### 4.3 อันดับที่ต้องคำนวณ
- อันดับรายเดือน (ตั้งแต่วันที่ 1 ถึงวันสุดท้ายของเดือน)
- อันดับทั้งหมด (All Time)
- แยกตามหมวด: Followers / Views

---

## 5. กระบวนการทำงาน

### 5.1 Data Flow

```
[YouTube/Twitch API]
        ↓
[Celery Beat ทุก 6 ชม.] → Scrape ข้อมูล → บันทึก StatsSnapshot
        ↓
[Celery ทุกวันที่ 1 เวลา 02:00] → คำนวณอันดับเดือนก่อน → บันทึก Ranking
        ↓
[Django REST API] → ส่งข้อมูลให้ Frontend
        ↓
[React Frontend] → แสดงผล Leaderboard
```

### 5.2 Scraping Schedule

| งาน | ความถี่ | เวลา |
|-----|---------|------|
| Scrape ข้อมูลสถิติ | ทุก 6 ชม. | 00:00, 06:00, 12:00, 18:00 |
| คำนวณอันดับรายเดือน | รายเดือน | วันที่ 1 เวลา 02:00 |
| คำนวณอันดับ All Time | รายสัปดาห์ | อาทิตย์ เวลา 03:00 |

---

## 6. กลไกการคำนวณ Rank Change

```
Rank Change = อันดับเดือนก่อน - อันดับเดือนนี้

ตัวอย่าง:
- เดือนก่อนอันดับ 5 → เดือนนี้อันดับ 3 → Rank Change = +2 (ขึ้น 2)
- เดือนก่อนอันดับ 2 → เดือนนี้อันดับ 4 → Rank Change = -2 (ลง 2)
- เข้ารายการครั้งแรก → Rank Change = NEW
- ไม่เปลี่ยน → แสดง —
```

---

## 7. ตัวกรองและการค้นหา

- ค้นหาตามชื่อ VTuber
- กรองตามแนวหน้า (Category)
- กรองตามสังกัด (Affiliation: Indie/Agency)
- กรองตามช่วงผู้ติดตาม
- เรียงลำดับตามอันดับ/ผู้ติดตาม/วิว

---

## 8. กำหนดการพัฒนา (แนะนำ)

| สัปดาห์ | งาน |
|---------|-----|
| 1 | Setup project (Django + Vite), models, admin |
| 2 | YouTube API integration + Celery scraping |
| 3 | API endpoints (DRF) + React frontend พื้นฐาน |
| 4 | Ranking algorithm + Charts + UI polish |
| 5 | Testing + Deploy |

---

## 9. ฟีเจอร์อนาคต (Phase 2)

- ระบบสมาชิก + โหวต Favorite
- แจ้งเตือนเมื่ออันดับเปลี่ยน (Email/Webhook)
- รวมข่าวสาร VTuber Thai
- Hall of Fame (อันดับ 1 ของแต่ละเดือน)
- ระบบ Export ข้อมูล CSV
- รองรับหลายภาษา (ไทย/อังกฤษ)
