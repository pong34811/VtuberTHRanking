# Ranking VTuber Thai

เว็บไซต์จัดอันดับ VTuber ไทย ข้อมูลจาก YouTube

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Backend | Django 5.x + DRF |
| Task Queue | Celery + Redis |
| Database | PostgreSQL |
| Frontend | React 19 + Vite 8 + Tailwind 4 |
| Charts | Recharts 3 |

## เริ่มต้น (Docker)

```bash
# สร้างไฟล์ .env
cp .env.example .env

# Start services ทั้งหมด
docker compose up -d

# Migrate database
docker compose exec backend python manage.py migrate

# สร้าง superuser (optional)
docker compose exec backend python manage.py createsuperuser

# Seed ข้อมูลตัวอย่าง
docker compose exec backend python manage.py seed_vtubers
```

## URL หลัก

| หน้า | URL |
|------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/api/v1/ |
| Admin | http://localhost:8000/admin/ |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/rankings/` | GET | ดึงอันดับตามเงื่อนไข |
| `/api/v1/vtubers/` | GET | ค้นหา/กรอง VTuber |
| `/api/v1/vtubers/{slug}/` | GET | ข้อมูล VTuber รายคน |
| `/api/v1/vtubers/{slug}/history/` | GET | ประวัติสถิติสำหรับกราฟ |
| `/api/v1/compare/` | POST | เปรียบเทียบ VTuber 2-3 คน |
| `/api/v1/summary/` | GET | สรุปข้อมูลสำหรับหน้าหลัก |

## การพัฒนาต่อ (Phase 2)

- ระบบสมาชิก + โหวต Favorite
- แจ้งเตือนเมื่ออันดับเปลี่ยน
- รวมข่าวสาร VTuber Thai
- Hall of Fame (อันดับ 1 ของแต่ละเดือน)
- Export ข้อมูล CSV
- รองรับหลายภาษา (ไทย/อังกฤษ)

## โครงสร้างโปรเจกต์

```
ranking_vtuberthai/
├── backend/
│   ├── apps/
│   │   ├── vtubers/          # Models, API, Admin
│   │   ├── scraper/          # Celery scraping tasks
│   │   └── rankings/         # Celery ranking calculator
│   ├── config/               # Django settings
│   └── manage.py
├── frontend/
│   └── src/
│       ├── api/              # Axios client
│       ├── components/       # Shared components
│       └── pages/            # Home, Profile, Compare, Search
├── docs/
│   └── superpowers/plans/    # Implementation plans
└── docker-compose.yml
```
