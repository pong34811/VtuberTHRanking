# API Specification

## Base URL

```
http://localhost:8000/api/v1
```

---

## Endpoints

### 1. ดึงอันดับตามเงื่อนไข

```
GET /rankings/
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | string | 否 | `monthly` หรือ `alltime` (default: `monthly`) |
| category | string | 否 | `followers` หรือ `views` (default: `followers`) |
| month | string | 否 | เดือนที่ต้องการ เช่น `2026-08` (default: เดือนปัจจุบัน) |
| limit | int | 否 | จำนวนรายการ (default: 50, max: 100) |
| offset | int | 否 | ตำแหน่งเริ่มต้น (default: 0) |

**Response:**
```json
{
  "period": "monthly",
  "category": "followers",
  "month": "2026-08-01",
  "total": 45,
  "count": 10,
  "next": "/api/v1/rankings/?period=monthly&category=followers&offset=10",
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
| ordering | string | 否 | เรียงลำดับ (name, -name) |

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
      "affiliation": "indie"
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

### 6. สรุปข้อมูลสำหรับหน้าหลัก

```
GET /summary/
```

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

## Rate Limiting

- API ทั่วไป: 100 requests/minute
- Scrape trigger: 1 request/5 minutes (admin only)
