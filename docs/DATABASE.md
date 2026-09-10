# Database Schema & Models

## 1. Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────────┐
│      VTuber         │       │     StatsSnapshot        │
├─────────────────────┤       ├─────────────────────────┤
│ id (PK)             │──┐    │ id (PK)                 │
│ name                │  │    │ vtuber_id (FK)          │
│ slug (unique)       │  └───>│ followers               │
│ bio                 │       │ total_views             │
│ avatar              │       │ avg_views               │
│ channel_url         │       │ recorded_at             │
│ platform            │       └─────────────────────────┘
│ category            │
│ affiliation         │       ┌─────────────────────────┐
│ agency_name         │       │       Ranking           │
│ is_active           │       ├─────────────────────────┤
│ created_at          │       │ id (PK)                 │
│ updated_at          │       │ vtuber_id (FK)          │
└─────────────────────┘       │ period                  │
                              │ category                │
                              │ rank                    │
                              │ score                   │
                              │ rank_change             │
                              │ month                   │
                              │ calculated_at           │
                              └─────────────────────────┘
```

---

## 2. Django Models

### VTuber Model

```python
from django.db import models

class VTuber(models.Model):
    PLATFORM_CHOICES = [
        ('youtube', 'YouTube'),
        ('twitch', 'Twitch'),
        ('bilibili', 'Bilibili'),
        ('other', 'Other'),
    ]
    
    CATEGORY_CHOICES = [
        ('gaming', 'Gaming'),
        ('singing', 'Singing'),
        ('chatting', 'Chatting'),
        ('art', 'Art'),
        ('asmr', 'ASMR'),
        ('education', 'Education'),
        ('other', 'Other'),
    ]
    
    AFFILIATION_CHOICES = [
        ('indie', 'Indie'),
        ('agency', 'Agency'),
    ]
    
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, max_length=100)
    bio = models.TextField(blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', blank=True)
    channel_url = models.URLField()
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='youtube')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    affiliation = models.CharField(max_length=10, choices=AFFILIATION_CHOICES, default='indie')
    agency_name = models.CharField(max_length=100, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'vtubers'
        ordering = ['name']
    
    def __str__(self):
        return self.name
```

### StatsSnapshot Model

```python
class StatsSnapshot(models.Model):
    vtuber = models.ForeignKey(VTuber, on_delete=models.CASCADE, related_name='snapshots')
    followers = models.BigIntegerField(default=0)
    total_views = models.BigIntegerField(default=0)
    avg_views = models.IntegerField(default=0)
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'stats_snapshots'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['vtuber', 'recorded_at']),
            models.Index(fields=['recorded_at']),
        ]
    
    def __str__(self):
        return f"{self.vtuber.name} - {self.recorded_at.strftime('%Y-%m-%d %H:%M')}"
```

### Ranking Model

```python
class Ranking(models.Model):
    PERIOD_CHOICES = [
        ('monthly', 'Monthly'),
        ('alltime', 'All Time'),
    ]
    
    CATEGORY_CHOICES = [
        ('followers', 'Followers'),
        ('views', 'Views'),
    ]
    
    vtuber = models.ForeignKey(VTuber, on_delete=models.CASCADE, related_name='rankings')
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES)
    rank = models.PositiveIntegerField()
    score = models.BigIntegerField()
    rank_change = models.IntegerField(default=0)
    month = models.DateField(null=True, blank=True)  # null = alltime
    calculated_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'rankings'
        unique_together = [('period', 'category', 'month', 'vtuber')]
        ordering = ['rank']
        indexes = [
            models.Index(fields=['period', 'category', 'month', 'rank']),
        ]
    
    def __str__(self):
        return f"#{self.rank} {self.vtuber.name} ({self.period}/{self.category})"
```

---

## 3. Database Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| stats_snapshots | (vtuber, recorded_at) | ค้นหา snapshot ล่าสุดของ VTuber |
| stats_snapshots | (recorded_at) | ค้นหา snapshot ตามช่วงเวลา |
| rankings | (period, category, month, rank) | ดึงอันดับตามเงื่อนไข |
| rankings | unique_together | ป้องกันข้อมูลซ้ำ |

---

## 4. Migration Commands

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 5. Sample Data (สำหรับทดสอบ)

```python
# สร้าง VTuber ตัวอย่าง
vtubers = [
    VTuber.objects.create(
        name="VTuber A",
        slug="vtuber-a",
        bio="Gaming VTuber จากกรุงเทพ",
        channel_url="https://youtube.com/@vtubera",
        platform="youtube",
        category="gaming",
        affiliation="indie",
    ),
    # ... เพิ่มตามต้องการ
]
```
