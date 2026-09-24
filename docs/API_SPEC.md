# API Specification

## Base URL

```
/api/v1
```

---

API ใช้ Hono บน Cloudflare Pages Functions และ Cloudflare D1
Production: https://vtuberthai-ranking.pages.dev/api/v1
Local: http://localhost:5173/api/v1 (Vite proxy ไป production ตาม frontend/vite.config.js)
โค้ดอ้างอิง: frontend/server/public.js; auth/admin ดู frontend/AUTH.md

## Endpoints

### Public metadata directory for the homepage

```
GET /directory/
```

This endpoint returns active creator profile metadata only. It is separate from `/vtubers/`, whose existing follower filters and ranking consumers remain unchanged.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | No | Case-insensitive name substring. Bound as a query value. |
| category | string | No | `gaming`, `singing`, `chatting`, `art`, `asmr`, `education`, or `other`; an unknown nonempty value returns 400. |
| affiliation | string | No | `indie` or `agency`; an unknown nonempty value returns 400. |
| sort | string | No | `name` (default) or `created_at_desc`; unknown values use `name`. |
| limit | int | No | Page size (default: 12, min: 1, max: 100); malformed values use the default and out-of-range values are clamped. |
| offset | int | No | Zero-based page offset (default: 0); malformed or negative values use 0. |

**Response:**

```json
{
  "total": 3,
  "count": 1,
  "limit": 1,
  "offset": 0,
  "results": [
    {
      "id": 1,
      "name": "VTuber A",
      "slug": "vtuber-a",
      "avatar": "/media/avatars/a.png",
      "category": "gaming",
      "affiliation": "indie",
      "created_at": "2026-09-20 00:00:00"
    }
  ],
  "category_counts": [
    { "category": "gaming", "count": 2 },
    { "category": "singing", "count": 1 }
  ]
}
```

`total` counts active profiles matching the requested filters; `count` is the number of rows on this page. `category_counts` counts every active profile regardless of the request filters or pagination. Rows expose only `id`, `name`, `slug`, `avatar`, `category`, `affiliation`, and `created_at`; the endpoint does not return snapshot, follower, or ranking metrics. Name sort uses case-insensitive name order with ID as the tie breaker. Newest sort uses valid creation timestamps descending, followed by name and ID; missing and malformed timestamps are placed last. The date means when the profile was added to this directory.

### Public homepage configuration

```
GET /homepage-config/
```

Returns the published discovery layout in `{ "template": "search-first" }`. Accepted values are `search-first`, `category-first`, and `newest-first`. Missing, invalid, and legacy IDs normalize to `search-first`. The response uses `Cache-Control: no-store` so a newly published layout is visible on the next Home load. This endpoint reads only the `homepage_template` setting; `/summary/` remains dedicated to ranking statistics and does not include template configuration.

### 1. ดึงอันดับตามเงื่อนไข

```
GET /rankings/
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | 否 | `monthly` หรือ `alltime` (default: `monthly`) |
| category | string | 否 | `followers`, `views` หรือ `videos` (default: `followers`) |
| month | string | 否 | เดือนที่ต้องการ เช่น `2026-08` (default: เดือนปัจจุบัน) |
| limit | int | 否 | จำนวนรายการ (default: 50, min: 1, max: 100); ค่าผิดรูปแบบใช้ค่าเริ่มต้น |
| offset | int | 否 | ตำแหน่งเริ่มต้น (default: 0) |

**Response:**
```json
{
  "period": "monthly",
  "category": "followers",
  "month": "2026-08",
  "total": 45,
  "count": 10,
  "next": "/api/v1/rankings/?period=monthly&category=followers&limit=10&offset=10&month=2026-08",
  "previous": null,
  "results": [
    {
      "rank": 1,
      "vtuber": {
        "id": 1,
        "name": "VTuber A",
        "slug": "vtuber-a",
        "avatar": "/media/avatars/2026/08/a.png",
        "category": "gaming",
        "affiliation": "indie"
      },
      "score": 1250000,
      "rank_change": 2
    },
    {
      "rank": 2,
      "vtuber": {
        "id": 2,
        "name": "VTuber B",
        "slug": "vtuber-b",
        "avatar": "/media/avatars/2026/08/b.png",
        "category": "singing",
        "affiliation": "agency"
      },
      "score": 980000,
      "rank_change": -1
    }
  ]
}
```

---

### 2. ดึงข้อมูล VTuber รายคน

```
GET /vtubers/{slug}/
```

**Response:**
```json
{
  "id": 1,
  "name": "VTuber A",
  "slug": "vtuber-a",
  "bio": "Gaming VTuber จากกรุงเทพ",
  "avatar": "/media/avatars/2026/08/a.png",
  "channel_url": "https://youtube.com/@vtubera",
  "platform": "youtube",
  "category": "gaming",
  "affiliation": "indie",
  "agency_name": "",
  "is_active": true,
  "current_rank": {
    "monthly_followers": 1,
    "monthly_views": 3,
    "alltime_followers": 2,
    "alltime_views": 5
  },
  "latest_stats": {
    "followers": 1250000,
    "total_views": 50000000,
    "avg_views": 15000,
    "recorded_at": "2026-08-15T06:00:00Z"
  }
}
```

---

### 3. ดึงประวัติสถิติ VTuber (สำหรับกราฟ)

```
GET /vtubers/{slug}/history/
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| months | int | 否 | จำนวนเดือนย้อนหลัง (default: 6, max: 12) |

**Response:**
```json
{
  "vtuber": {
    "id": 1,
    "name": "VTuber A",
    "slug": "vtuber-a"
  },
  "history": [
    {
      "date": "2026-08-01",
      "followers": 1250000,
      "total_views": 50000000,
      "avg_views": 15000
    },
    {
      "date": "2026-07-01",
      "followers": 1100000,
      "total_views": 45000000,
      "avg_views": 12000
    }
  ]
}
```

---

### 4. ค้นหา VTuber

```
GET /vtubers/
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | 否 | ค้นหาจากชื่อ |
| category | string | 否 | กรองตามแนวหน้า |
| affiliation | string | 否 | กรองตามสังกัด |
| min_followers | integer | 否 | จำนวนผู้ติดตามขั้นต่ำจากสถิติล่าสุด (ตั้งแต่ 0 ขึ้นไป) |
| max_followers | integer | 否 | จำนวนผู้ติดตามสูงสุดจากสถิติล่าสุด (ตั้งแต่ 0 ขึ้นไป) |
| sort | string | 否 | `name` (ค่าเริ่มต้น), `followers_desc` หรือ `followers_asc`; ผู้ติดตามที่ไม่มีข้อมูลจะแสดงท้ายรายการ |

ระบบตอบกลับ `400` เมื่อค่าช่วงผู้ติดตามไม่ใช่จำนวนเต็มที่ปลอดภัย หรือค่าขั้นต่ำมากกว่าค่าสูงสุด ผลลัพธ์แต่ละรายการมีฟิลด์ `followers` ซึ่งเป็นจำนวนล่าสุดหรือ `null` หากไม่มีข้อมูล

**Response:**
```json
{
  "count": 45,
  "results": [
    {
      "id": 1,
      "name": "VTuber A",
      "slug": "vtuber-a",
      "avatar": "/media/avatars/2026/08/a.png",
      "category": "gaming",
      "affiliation": "indie",
      "followers": 12500
    }
  ]
}
```

---

### 5. เปรียบเทียบ VTuber

```
POST /compare/
```

**Request Body:**
```json
{
  "vtubers": [1, 2, 3],
  "category": "followers",
  "months": 6
}
```

**Response:**
```json
{
  "category": "followers",
  "vtubers": [
    {
      "id": 1,
      "name": "VTuber A",
      "slug": "vtuber-a",
      "color": "#ef4444",
      "history": [
        {"date": "2026-08-01", "value": 1250000},
        {"date": "2026-07-01", "value": 1100000}
      ]
    },
    {
      "id": 2,
      "name": "VTuber B",
      "slug": "vtuber-b",
      "color": "#3b82f6",
      "history": [
        {"date": "2026-08-01", "value": 980000},
        {"date": "2026-07-01", "value": 1050000}
      ]
    }
  ]
}
```

---

### 6. สรุปข้อมูลสำหรับหน้าสถิติ

```
GET /summary/
```

`/stats` uses this endpoint for ranking context. It does not contain the published homepage template; read that from `/homepage-config/`.

**Response:**
```json
{
  "total_vtubers": 45,
  "total_followers_all": 25000000,
  "top_gainer": {
    "vtuber": {"id": 3, "name": "VTuber C", "slug": "vtuber-c"},
    "rank_change": 5
  },
  "latest_update": "2026-08-15T06:00:00Z",
  "period_choices": [
    {"value": "monthly", "label": "รายเดือน"},
    {"value": "alltime", "label": "ทั้งหมด"}
  ],
  "category_choices": [
    {"value": "followers", "label": "ยอดผู้ติดตาม"},
    {"value": "views", "label": "ยอดวิว"}
  ]
}
```

---

## Error Responses

```json
{
  "error": true,
  "status": 404,
  "message": "VTuber not found",
  "detail": "ไม่พบข้อมูล VTuber ที่ต้องการ"
}
```

---

## พฤติกรรมปัจจุบันและข้อจำกัด

- ลิงก์ next/previous เก็บ period, category, limit และ month ของรายเดือน; month รูปแบบไม่ถูกต้องใช้เดือนปัจจุบันตามเวลาไทย (UTC+7)
- current_rank ในโปรไฟล์ใช้เฉพาะอันดับ active ของเดือนปัจจุบันตามเวลาไทย (UTC+7) และ alltime; หมวดที่ไม่มีข้อมูลจะไม่มี key
- ค้นหาเรียงตาม name ASC; ยังไม่รองรับ ordering และช่วงผู้ติดตาม
- API เปรียบเทียบรองรับ 2–5 IDs ขณะที่หน้าเว็บเลือกได้ 2–3 ช่อง
- ประวัติสถิติเรียงจากเก่าไปใหม่; ตัวอย่างข้อมูลด้านบนใช้แสดงโครงสร้าง response
- summary.total_followers_all ปัจจุบันใช้ MAX(followers) จาก snapshots ของช่อง active ไม่ใช่ผลรวม ต้องแก้ implementation ก่อนใช้เป็นยอดรวม
- ยังไม่มี rate limit สำหรับ public API ใน router นี้; authentication มีการจำกัดความพยายามเข้าสู่ระบบแยกต่างหาก
