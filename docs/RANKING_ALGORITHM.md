# Ranking Algorithm Specification

## 1. หลักการทำงาน

### 1.1 การจัดอันดับ

| หมวด | วิธีคำนวณ |
|------|-----------|
| Followers | นับจากจำนวนผู้ติดตามย้อนหลังสุดของเดือนนั้น |
| Views | นับจากยอดวิวรวม (Total Views) ย้อนหลังสุดของเดือนนั้น |

### 1.2 ช่วงเวลา

| ประเภท | คำอธิบาย |
|--------|---------|
| Monthly | ข้อมูล snapshot ล่าสุดภายในเดือนนั้น (ปกติจะเป็นวันสุดท้ายหรือใกล้เคียง) |
| All Time | ข้อมูล snapshot ล่าสุดที่มี (ขึ้นกับวันปัจจุบัน) |

---

## 2. Algorithm คำนวณ Rank Change

### 2.1 สูตร

```
Rank Change = Previous Rank - Current Rank

ผลลัพธ์:
  +N  → ขึ้น N อันดับ (แสดง ↑N)
  -N  → ลง N อันดับ (แสดง ↓N)
   0  → อันดับเท่าเดิม (แสดง —)
  null → ไม่มีอันดับเดือนก่อน (แสดง NEW)
```

### 2.2 ตัวอย่าง

```
VTuber A:
  เดือนก่อน: อันดับ 5
  เดือนนี้:  อันดับ 3
  Change = 5 - 3 = +2 → แสดง ↑2 (เขียว)

VTuber B:
  เดือนก่อน: อันดับ 2
  เดือนนี้:  อันดับ 4
  Change = 2 - 4 = -2 → แสดง ↓2 (แดง)

VTuber C:
  เดือนก่อน: ไม่มี (เพิ่งเข้ารายการ)
  เดือนนี้:  อันดับ 1
  แสดง NEW (เหลือง)
```

---

## 3. ขั้นตอนการคำนวณ (Pseudocode)

```python
def calculate_rankings(category: str, target_month: date):
    """
    คำนวณอันดับสำหรับเดือนที่กำหนด
    
    Args:
        category: 'followers' หรือ 'views'
        target_month: วันที่ 1 ของเดือน (เช่น 2026-08-01)
    """
    
    # 1. หาช่วงวันของเดือน
    month_start = target_month
    month_end = (target_month + relativedelta(months=1)) - timedelta(days=1)
    
    # 2. ดึง snapshot ล่าสุดของแต่ละ VTuber ในเดือนนั้น
    latest_snapshots = (
        StatsSnapshot.objects
        .filter(
            recorded_at__date__gte=month_start,
            recorded_at__date__lte=month_end,
            vtuber__is_active=True
        )
        .order_by('vtuber', '-recorded_at')
        .distinct('vtuber')
    )
    
    # 3. จัดอันดับตามคะแนน (มาก → น้อย)
    sorted_vtubers = sorted(
        latest_snapshots,
        key=lambda s: get_score(s, category),
        reverse=True
    )
    
    # 4. ดึงอันดับเดือนก่อนมาเปรียบเทียบ
    prev_month = target_month - relativedelta(months=1)
    prev_rankings = Ranking.objects.filter(
        period='monthly',
        category=category,
        month=prev_month
    )
    prev_rank_map = {r.vtuber_id: r.rank for r in prev_rankings}
    
    # 5. บันทึกผลลัพธ์
    results = []
    for idx, snapshot in enumerate(sorted_vtubers, start=1):
        prev_rank = prev_rank_map.get(snapshot.vtuber_id)
        
        if prev_rank is None:
            rank_change = 0  # VTuber ใหม่
            is_new = True
        else:
            rank_change = prev_rank - idx
            is_new = False
        
        ranking, created = Ranking.objects.update_or_create(
            vtuber=snapshot.vtuber,
            period='monthly',
            category=category,
            month=target_month,
            defaults={
                'rank': idx,
                'score': get_score(snapshot, category),
                'rank_change': rank_change,
            }
        )
        
        results.append({
            'ranking': ranking,
            'prev_rank': prev_rank,
            'is_new': is_new,
        })
    
    return results


def get_score(snapshot: StatsSnapshot, category: str) -> int:
    """ดึงคะแนนตามหมวดที่เลือก"""
    if category == 'followers':
        return snapshot.followers
    elif category == 'views':
        return snapshot.total_views
    return 0
```

---

## 4. การคำนวณ All Time

```python
def calculate_alltime_rankings(category: str):
    """
    คำนวณอันดับ All Time (ข้อมูลล่าสุดทั้งหมด)
    """
    
    # ดึง snapshot ล่าสุดของแต่ละ VTuber
    latest_snapshots = (
        StatsSnapshot.objects
        .filter(vtuber__is_active=True)
        .order_by('vtuber', '-recorded_at')
        .distinct('vtuber')
    )
    
    # จัดอันดับ
    sorted_vtubers = sorted(
        latest_snapshots,
        key=lambda s: get_score(s, category),
        reverse=True
    )
    
    # ดึง All Time Ranking เดิมมาเปรียบเทียบ
    prev_rankings = Ranking.objects.filter(
        period='alltime',
        category=category,
        month__isnull=True
    )
    prev_rank_map = {r.vtuber_id: r.rank for r in prev_rankings}
    
    # บันทึกผล (month=None สำหรับ alltime)
    for idx, snapshot in enumerate(sorted_vtubers, start=1):
        prev_rank = prev_rank_map.get(snapshot.vtuber_id)
        rank_change = (prev_rank - idx) if prev_rank else 0
        
        Ranking.objects.update_or_create(
            vtuber=snapshot.vtuber,
            period='alltime',
            category=category,
            month=None,
            defaults={
                'rank': idx,
                'score': get_score(snapshot, category),
                'rank_change': rank_change,
            }
        )
```

---

## 5. Celery Schedule Configuration

```python
# celery.py
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Scrape ข้อมูลทุก 6 ชั่วโมง
    'scrape-every-6-hours': {
        'task': 'apps.scraper.tasks.scrape_all_vtubers',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    
    # คำนวณอันดับรายเดือน: วันที่ 1 ของเดือน เวลา 02:00
    'monthly-ranking': {
        'task': 'apps.rankings.tasks.calculate_monthly_rankings',
        'schedule': crontab(minute=0, hour=2, day_of_month=1),
    },
    
    # คำนวณ All Time: ทุกวันอาทิตย์ เวลา 03:00
    'alltime-ranking': {
        'task': 'apps.rankings.tasks.calculate_alltime_rankings',
        'schedule': crontab(minute=0, hour=3, day_of_week=0),
    },
}
```

---

## 6. การจัดการข้อผิดพลาด

| สถานการณ์ | วิธีจัดการ |
|-----------|-----------|
| Scrape ไม่สำเร็จ | Retry 3 ครั้ง ห่างกัน 5 นาที ถ้าไม่ได้ข้ามไป VTuber ถัดไป |
| ไม่มีข้อมูลเดือนก่อน | ให้ Rank Change = 0 และ is_new = False |
| VTuber ใหม่เข้ารายการ | แสดง "NEW" ในเดือนแรก |
| ข้อมูลซ้ำซ้อน | ใช้ unique_together + update_or_create |

---

## 7. ตัวอย่างผลลัพธ์

```
╔═══════════════════════════════════════════════════════════════╗
║  🏆 อันดับผู้ติดตาม — สิงหาคม 2026                           ║
╠════╦════════════════════════╦══════════════╦═════════════════╣
║ #  ║ ชื่อ                   ║ ผู้ติดตาม     ║ เปลี่ยนแปลง      ║
╠════╬════════════════════════╬══════════════╬═════════════════╣
║ 1  ║ VTuber A               ║ 1,250,000    ║  ↑ 2            ║
║ 2  ║ VTuber B               ║ 980,000      ║  ↓ 1            ║
║ 3  ║ VTuber C [NEW]         ║ 750,000      ║  NEW            ║
║ 4  ║ VTuber D               ║ 620,000      ║  —              ║
║ 5  ║ VTuber E               ║ 510,000      ║  ↓ 2            ║
╚════╩════════════════════════╩══════════════╩═════════════════╝
```
