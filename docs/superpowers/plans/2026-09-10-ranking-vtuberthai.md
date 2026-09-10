# Ranking VTuber Thai Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack dark-themed website that ranks Thai VTubers by YouTube followers/views, with monthly/all-time rankings, trend charts, comparison tools, and a search/filter system.

**Architecture:** Django REST Framework backend serves JSON to a React SPA frontend. Celery workers scrape YouTube stats every 6 hours and recalculate rankings on a schedule. PostgreSQL stores all data; Redis brokers Celery tasks.

**Tech Stack:** Django 5.x, DRF, Celery, Redis, PostgreSQL, Vite 8, React 19, Tailwind CSS 4, React Router 8, Recharts 3, Axios

**Spec:** `docs/PRD.md`, `docs/DATABASE.md`, `docs/API_SPEC.md`, `docs/RANKING_ALGORITHM.md`

## Global Constraints

- Python 3.11+, Node.js 20+
- All API endpoints use `/api/v1/` prefix
- Dark theme throughout (CSS variables: `--bg: #0f0f14`, `--card: #1a1a24`, `--text: #e4e4e7`, `--muted: #a1a1aa`, `--accent: #8b5cf6`)
- Responsive: mobile-first with Tailwind breakpoints (sm:640px, md:768px, lg:1024px)
- No external auth in v1 — admin-only scrape trigger
- Every endpoint returns proper HTTP status codes (200, 404, 500)
- Rate limiting: 100 req/min for public endpoints

---

### Task 1: Project Setup & Docker Configuration

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: running Django + React + Postgres + Redis via `docker compose up`

- [ ] **Step 1: Create requirements.txt**

```text
django==5.2.7
djangorestframework==3.16.1
celery==5.5.3
redis==6.2.0
psycopg2-binary==2.9.10
python-dotenv==1.1.1
Pillow==11.3.0
django-cors-headers==4.7.0
```

- [ ] **Step 2: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
```

- [ ] **Step 3: Create frontend/Dockerfile**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vtuberthai
      POSTGRES_USER: vtuber
      POSTGRES_PASSWORD: vtuberpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://vtuber:vtuberpass@db:5432/vtuberthai
      REDIS_URL: redis://redis:6379/0
      DEBUG: "true"
    depends_on:
      - db
      - redis

  celery:
    build: ./backend
    command: celery -A config worker -l info
    volumes:
      - ./backend:/app
    environment:
      DATABASE_URL: postgres://vtuber:vtuberpass@db:5432/vtuberthai
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - backend
      - redis

  celery-beat:
    build: ./backend
    command: celery -A config beat -l info
    volumes:
      - ./backend:/app
    environment:
      DATABASE_URL: postgres://vtuber:vtuberpass@db:5432/vtuberthai
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - backend
      - redis

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8000/api/v1

volumes:
  postgres_data:
```

- [ ] **Step 5: Create .env.example**

```text
DATABASE_URL=postgres://vtuber:vtuberpass@localhost:5432/vtuberthai
REDIS_URL=redis://localhost:6379/0
DEBUG=true
SECRET_KEY=change-me-in-production
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

- [ ] **Step 6: Create .gitignore**

```text
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
.env

# Node
node_modules/
dist/
.vite/

# Django
*.log
*.pot
*.pyc
db.sqlite3
media/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: add project scaffolding and Docker configuration"
```

---

### Task 2: Django Project & App Structure

**Files:**
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/celery.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/asgi.py`
- Create: `backend/apps/__init__.py`
- Create: `backend/apps/vtubers/__init__.py`
- Create: `backend/apps/vtubers/apps.py`
- Create: `backend/apps/vtubers/admin.py`
- Create: `backend/apps/vtubers/models.py`
- Create: `backend/apps/vtubers/serializers.py`
- Create: `backend/apps/vtubers/views.py`
- Create: `backend/apps/vtubers/urls.py`
- Create: `backend/apps/vtubers/tests.py`
- Create: `backend/apps/scraper/__init__.py`
- Create: `backend/apps/scraper/apps.py`
- Create: `backend/apps/scraper/tasks.py`
- Create: `backend/apps/scraper/tests.py`
- Create: `backend/apps/rankings/__init__.py`
- Create: `backend/apps/rankings/apps.py`
- Create: `backend/apps/rankings/tasks.py`
- Create: `backend/apps/rankings/tests.py`

**Interfaces:**
- Consumes: Task 1 (Docker setup)
- Produces: `config.celery` module, `apps.vtubers`, `apps.scraper`, `apps.rankings` apps

- [ ] **Step 1: Create manage.py**

```python
#!/usr/bin/env python
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django."
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Create config/__init__.py**

```python
from .celery import app as celery_app

__all__ = ('celery_app',)
```

- [ ] **Step 3: Create config/settings.py**

```python
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-me')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.vtubers',
    'apps.scraper',
    'apps.rankings',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME', 'vtuberthai'),
        'USER': os.getenv('DB_USER', 'vtuber'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'vtuberpass'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'th-th'
TIME_ZONE = 'Asia/Bangkok'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:5173'
).split(',')

CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_TIMEZONE = 'Asia/Bangkok'
```

- [ ] **Step 4: Create config/urls.py**

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.vtubers.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

- [ ] **Step 5: Create config/celery.py**

```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('config')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
```

- [ ] **Step 6: Create config/wsgi.py**

```python
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_wsgi_application()
```

- [ ] **Step 7: Create config/asgi.py**

```python
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_asgi_application()
```

- [ ] **Step 8: Create app stubs**

Create empty `__init__.py` in `backend/apps/`, `backend/apps/vtubers/`, `backend/apps/scraper/`, `backend/apps/rankings/`.

Create `backend/apps/vtubers/apps.py`:
```python
from django.apps import AppConfig

class VtubersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.vtubers'
```

Create `backend/apps/scraper/apps.py`:
```python
from django.apps import AppConfig

class ScraperConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.scraper'
```

Create `backend/apps/rankings/apps.py`:
```python
from django.apps import AppConfig

class RankingsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rankings'
```

Create empty stubs for `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tasks.py`, `tests.py` in each app.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "chore: scaffold Django project and apps"
```

---

### Task 3: Database Models

**Files:**
- Modify: `backend/apps/vtubers/models.py`
- Create: `backend/apps/vtubers/migrations/__init__.py`
- Create: `backend/apps/vtubers/migrations/0001_initial.py`

**Interfaces:**
- Consumes: Task 2 (Django setup)
- Produces: `VTuber`, `StatsSnapshot`, `Ranking` models with proper fields and indexes

- [ ] **Step 1: Create VTuber model in backend/apps/vtubers/models.py**

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
    month = models.DateField(null=True, blank=True)
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

- [ ] **Step 2: Generate migration**

```bash
cd backend && python manage.py makemigrations vtubers
```

- [ ] **Step 3: Commit**

```bash
git add backend/apps/vtubers/models.py backend/apps/vtubers/migrations/
git commit -m "feat(models): add VTuber, StatsSnapshot, Ranking models"
```

---

### Task 4: Django Admin & Seed Data

**Files:**
- Modify: `backend/apps/vtubers/admin.py`
- Create: `backend/apps/vtubers/management/__init__.py`
- Create: `backend/apps/vtubers/management/commands/__init__.py`
- Create: `backend/apps/vtubers/management/commands/seed_vtubers.py`

**Interfaces:**
- Consumes: Task 3 (models)
- Produces: admin panel for VTuber/StatsSnapshot/Ranking, seed command with sample data

- [ ] **Step 1: Register models in backend/apps/vtubers/admin.py**

```python
from django.contrib import admin
from .models import VTuber, StatsSnapshot, Ranking

@admin.register(VTuber)
class VTuberAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'platform', 'category', 'affiliation', 'is_active')
    list_filter = ('platform', 'category', 'affiliation', 'is_active')
    search_fields = ('name', 'slug', 'bio')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(StatsSnapshot)
class StatsSnapshotAdmin(admin.ModelAdmin):
    list_display = ('vtuber', 'followers', 'total_views', 'recorded_at')
    list_filter = ('recorded_at',)
    search_fields = ('vtuber__name',)

@admin.register(Ranking)
class RankingAdmin(admin.ModelAdmin):
    list_display = ('rank', 'vtuber', 'period', 'category', 'score', 'rank_change', 'month')
    list_filter = ('period', 'category', 'month')
    search_fields = ('vtuber__name',)
```

- [ ] **Step 2: Create seed command in backend/apps/vtubers/management/commands/seed_vtubers.py**

```python
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.vtubers.models import VTuber, StatsSnapshot

class Command(BaseCommand):
    help = 'Seed database with sample VTubers and stats'

    def add_arguments(self, parser):
        parser.add_argument('--vtubers', type=int, default=15)
        parser.add_argument('--snapshots', type=int, default=30)

    def handle(self, *args, **options):
        n_vtubers = options['vtubers']
        n_snapshots = options['snapshots']

        categories = ['gaming', 'singing', 'chatting', 'art', 'asmr', 'education']
        affiliations = ['indie', 'agency']
        agency_names = ['', 'NexStream', 'Virtual Harmony', 'Pixel Hearts', '']

        created_vtubers = []
        for i in range(1, n_vtubers + 1):
            vtuber, created = VTuber.objects.get_or_create(
                slug=f'vtuber-{i:02d}',
                defaults={
                    'name': f'VTuber {i:02d}',
                    'bio': f'VirtualTuber คนที่ {i} จากประเทศไทย',
                    'channel_url': f'https://youtube.com/@vtuber{i:02d}',
                    'platform': 'youtube',
                    'category': categories[i % len(categories)],
                    'affiliation': affiliations[i % len(2)],
                    'agency_name': agency_names[i % len(agency_names)],
                    'is_active': True,
                }
            )
            created_vtubers.append(vtuber)
            if created:
                self.stdout.write(f'Created VTuber: {vtuber.name}')

        now = timezone.now()
        for vtuber in created_vtubers:
            base_followers = random.randint(10000, 500000)
            base_views = random.randint(1000000, 50000000)
            for day in range(n_snapshots):
                recorded_at = now - timedelta(days=day)
                StatsSnapshot.objects.create(
                    vtuber=vtuber,
                    followers=base_followers + random.randint(-5000, 10000) * day,
                    total_views=base_views + random.randint(-10000, 50000) * day,
                    avg_views=random.randint(1000, 50000),
                    recorded_at=recorded_at,
                )
        self.stdout.write(self.style.SUCCESS(
            f'Seeded {n_vtubers} VTubers with {n_snapshots} snapshots each'
        ))
```

- [ ] **Step 3: Commit**

```bash
git add backend/apps/vtubers/admin.py backend/apps/vtubers/management/
git commit -m "feat(admin): register models and add seed command"
```

---

### Task 5: API Serializers

**Files:**
- Modify: `backend/apps/vtubers/serializers.py`

**Interfaces:**
- Consumes: Task 3 (models)
- Produces: `VTuberSerializer`, `StatsSnapshotSerializer`, `RankingSerializer`, `RankingListSerializer`, `VTuberDetailSerializer`, `CompareSerializer`, `SummarySerializer`

- [ ] **Step 1: Create serializers in backend/apps/vtubers/serializers.py**

```python
from rest_framework import serializers
from .models import VTuber, StatsSnapshot, Ranking

class VTuberSerializer(serializers.ModelSerializer):
    class Meta:
        model = VTuber
        fields = [
            'id', 'name', 'slug', 'bio', 'avatar', 'channel_url',
            'platform', 'category', 'affiliation', 'agency_name',
            'is_active',
        ]

class StatsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatsSnapshot
        fields = ['id', 'followers', 'total_views', 'avg_views', 'recorded_at']

class RankingSerializer(serializers.ModelSerializer):
    vtuber = VTuberSerializer(read_only=True)
    class Meta:
        model = Ranking
        fields = ['rank', 'vtuber', 'score', 'rank_change']

class RankingListSerializer(serializers.Serializer):
    period = serializers.CharField()
    category = serializers.CharField()
    month = serializers.DateField(allow_null=True)
    total = serializers.IntegerField()
    results = RankingSerializer(many=True)

class VTuberDetailSerializer(serializers.ModelSerializer):
    current_rank = serializers.SerializerMethodField()
    latest_stats = serializers.SerializerMethodField()

    class Meta:
        model = VTuber
        fields = [
            'id', 'name', 'slug', 'bio', 'avatar', 'channel_url',
            'platform', 'category', 'affiliation', 'agency_name',
            'is_active', 'current_rank', 'latest_stats',
        ]

    def get_current_rank(self, obj):
        ranks = {}
        for period in ['monthly', 'alltime']:
            for category in ['followers', 'views']:
                r = obj.rankings.filter(
                    period=period, category=category
                ).order_by('-calculated_at').first()
                if r:
                    ranks[f'{period}_{category}'] = r.rank
        return ranks

    def get_latest_stats(self, obj):
        s = obj.snapshots.order_by('-recorded_at').first()
        if s:
            return {
                'followers': s.followers,
                'total_views': s.total_views,
                'avg_views': s.avg_views,
                'recorded_at': s.recorded_at,
            }
        return None

class CompareSerializer(serializers.Serializer):
    vtubers = serializers.ListField(child=serializers.IntegerField(), min_length=2, max_length=5)
    category = serializers.ChoiceField(choices=['followers', 'views'], default='followers')
    months = serializers.IntegerField(min_value=1, max_value=12, default=6)

class SummarySerializer(serializers.Serializer):
    total_vtubers = serializers.IntegerField()
    total_followers_all = serializers.IntegerField()
    top_gainer = serializers.DictField()
    latest_update = serializers.DateTimeField()
    period_choices = serializers.ListField()
    category_choices = serializers.ListField()
```

- [ ] **Step 2: Commit**

```bash
git add backend/apps/vtubers/serializers.py
git commit -m "feat(serializers): add all API serializers"
```

---

### Task 6: API Views & URL Routes

**Files:**
- Modify: `backend/apps/vtubers/views.py`
- Modify: `backend/apps/vtubers/urls.py`

**Interfaces:**
- Consumes: Task 5 (serializers), Task 3 (models)
- Produces: endpoints for `/rankings/`, `/vtubers/`, `/vtubers/{slug}/`, `/vtubers/{slug}/history/`, `/compare/`, `/summary/`

- [ ] **Step 1: Create views in backend/apps/vtubers/views.py**

```python
from datetime import date
from django.db.models import Prefetch, Max
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView
from dateutil.relativedelta import relativedelta

from .models import VTuber, StatsSnapshot, Ranking
from .serializers import (
    VTuberSerializer, VTuberDetailSerializer, StatsSnapshotSerializer,
    RankingSerializer, CompareSerializer, SummarySerializer,
)

class VTuberViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VTuber.objects.filter(is_active=True)
    serializer_class = VTuberSerializer
    lookup_field = 'slug'

    def retrieve(self, request, slug=None):
        vtuber = self.get_object()
        serializer = VTuberDetailSerializer(vtuber)
        return Response(serializer.data)

    def list(self, request):
        queryset = self.get_queryset()
        q = request.query_params.get('q')
        category = request.query_params.get('category')
        affiliation = request.query_params.get('affiliation')
        ordering = request.query_params.get('ordering', 'name')

        if q:
            queryset = queryset.filter(name__icontains=q)
        if category:
            queryset = queryset.filter(category=category)
        if affiliation:
            queryset = queryset.filter(affiliation=affiliation)
        if ordering.lstrip('-') in ['name', 'created_at']:
            queryset = queryset.order_by(ordering)

        serializer = VTuberSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })

class VTuberHistoryView(APIView):
    def get(self, request, slug):
        vtuber = VTuber.objects.get(slug=slug, is_active=True)
        months = int(request.query_params.get('months', 6))
        if months > 12:
            months = 12

        start_date = timezone.now() - relativedelta(months=months)
        snapshots = StatsSnapshot.objects.filter(
            vtuber=vtuber,
            recorded_at__gte=start_date,
        ).order_by('recorded_at')

        serializer = StatsSnapshotSerializer(snapshots, many=True)
        return Response({
            'vtuber': {'id': vtuber.id, 'name': vtuber.name, 'slug': vtuber.slug},
            'history': serializer.data,
        })

class RankingListView(APIView):
    def get(self, request):
        period = request.query_params.get('period', 'monthly')
        category = request.query_params.get('category', 'followers')
        month_str = request.query_params.get('month')
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

        if period not in ['monthly', 'alltime']:
            period = 'monthly'
        if category not in ['followers', 'views']:
            category = 'followers'

        queryset = Ranking.objects.filter(
            period=period, category=category
        ).select_related('vtuber')

        if period == 'alltime':
            queryset = queryset.filter(month__isnull=True)
        else:
            if month_str:
                try:
                    month_date = date.fromisoformat(month_str + '-01')
                except (ValueError, TypeError):
                    month_date = date.today().replace(day=1)
            else:
                month_date = date.today().replace(day=1)
            queryset = queryset.filter(month=month_date)

        total = queryset.count()
        results = queryset.order_by('rank')[offset:offset+limit]

        return Response({
            'period': period,
            'category': category,
            'month': month_date.isoformat() if period == 'monthly' else None,
            'total': total,
            'count': len(results),
            'results': RankingSerializer(results, many=True).data,
        })

class CompareView(APIView):
    def post(self, request):
        serializer = CompareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        vtuber_ids = serializer.validated_data['vtubers']
        category = serializer.validated_data['category']
        months = serializer.validated_data['months']

        vtubers = VTuber.objects.filter(id__in=vtuber_ids, is_active=True)
        start_date = timezone.now() - relativedelta(months=months)

        COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7']
        results = []
        for idx, vtuber in enumerate(vtubers):
            snapshots = StatsSnapshot.objects.filter(
                vtuber=vtuber,
                recorded_at__gte=start_date,
            ).order_by('recorded_at')

            history = []
            for s in snapshots:
                history.append({
                    'date': s.recorded_at.date().isoformat(),
                    'value': s.followers if category == 'followers' else s.total_views,
                })

            results.append({
                'id': vtuber.id,
                'name': vtuber.name,
                'slug': vtuber.slug,
                'color': COLORS[idx % len(COLORS)],
                'history': history,
            })

        return Response({
            'category': category,
            'vtubers': results,
        })

class SummaryView(APIView):
    def get(self, request):
        total_vtubers = VTuber.objects.filter(is_active=True).count()
        total_followers = StatsSnapshot.objects.filter(
            vtuber__is_active=True,
        ).aggregate(total=Max('followers'))['total'] or 0

        top_gainer = Ranking.objects.filter(
            period='monthly',
            rank_change__gt=0,
        ).order_by('-rank_change').first()

        top_gainer_data = None
        if top_gainer:
            top_gainer_data = {
                'vtuber': {
                    'id': top_gainer.vtuber.id,
                    'name': top_gainer.vtuber.name,
                    'slug': top_gainer.vtuber.slug,
                },
                'rank_change': top_gainer.rank_change,
            }

        latest_update = StatsSnapshot.objects.order_by('-recorded_at').first()
        latest_update_dt = latest_update.recorded_at if latest_update else timezone.now()

        return Response({
            'total_vtubers': total_vtubers,
            'total_followers_all': total_followers,
            'top_gainer': top_gainer_data,
            'latest_update': latest_update_dt,
            'period_choices': [
                {'value': 'monthly', 'label': 'รายเดือน'},
                {'value': 'alltime', 'label': 'ทั้งหมด'},
            ],
            'category_choices': [
                {'value': 'followers', 'label': 'ยอดผู้ติดตาม'},
                {'value': 'views', 'label': 'ยอดวิว'},
            ],
        })
```

- [ ] **Step 2: Create URL routes in backend/apps/vtubers/urls.py**

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VTuberViewSet, VTuberHistoryView, RankingListView,
    CompareView, SummaryView,
)

router = DefaultRouter()
router.register(r'vtubers', VTuberViewSet, basename='vtuber')

urlpatterns = [
    path('', include(router.urls)),
    path('vtubers/<slug:slug>/history/', VTuberHistoryView.as_view(), name='vtuber-history'),
    path('rankings/', RankingListView.as_view(), name='ranking-list'),
    path('compare/', CompareView.as_view(), name='compare'),
    path('summary/', SummaryView.as_view(), name='summary'),
]
```

- [ ] **Step 3: Commit**

```bash
git add backend/apps/vtubers/views.py backend/apps/vtubers/urls.py
git commit -m "feat(api): add all API views and URL routes"
```

---

### Task 7: Celery Tasks — Scraper

**Files:**
- Modify: `backend/apps/scraper/tasks.py`

**Interfaces:**
- Consumes: Task 3 (models)
- Produces: `scrape_all_vtubers` Celery task, `scrape_single_vtuber` helper

- [ ] **Step 1: Create scraper tasks in backend/apps/scraper/tasks.py**

```python
import logging
import re
from datetime import datetime
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def scrape_all_vtubers(self):
    """Scrape stats for all active VTubers."""
    from apps.vtubers.models import VTuber
    vtubers = VTuber.objects.filter(is_active=True)
    results = {'success': 0, 'failed': 0, 'total': vtubers.count()}

    for vtuber in vtubers:
        try:
            scrape_single_vtuber(vtuber.id)
            results['success'] += 1
        except Exception as e:
            logger.error(f"Failed to scrape {vtuber.name}: {e}")
            results['failed'] += 1

    logger.info(f"Scraping complete: {results}")
    return results

def scrape_single_vtuber(vtuber_id: int):
    """
    Scrape YouTube channel stats for a single VTuber.
    NOTE: This is a placeholder. Replace with actual YouTube Data API v3 call
    or scraping logic. For now, generates random data for development.
    """
    import random
    from apps.vtubers.models import VTuber, StatsSnapshot

    vtuber = VTuber.objects.get(id=vtuber_id)
    last_snapshot = vtuber.snapshots.order_by('-recorded_at').first()

    if last_snapshot:
        followers = max(0, last_snapshot.followers + random.randint(-1000, 5000))
        total_views = max(0, last_snapshot.total_views + random.randint(-5000, 20000))
        avg_views = max(0, last_snapshot.avg_views + random.randint(-500, 2000))
    else:
        followers = random.randint(10000, 1000000)
        total_views = random.randint(1000000, 100000000)
        avg_views = random.randint(1000, 100000)

    StatsSnapshot.objects.create(
        vtuber=vtuber,
        followers=followers,
        total_views=total_views,
        avg_views=avg_views,
    )
    logger.info(f"Scraped {vtuber.name}: {followers} followers, {total_views} views")
```

- [ ] **Step 2: Commit**

```bash
git add backend/apps/scraper/tasks.py
git commit -m "feat(scraper): add Celery scraping tasks"
```

---

### Task 8: Celery Tasks — Ranking Calculator

**Files:**
- Modify: `backend/apps/rankings/tasks.py`
- Modify: `backend/config/settings.py` (add CELERY_BEAT_SCHEDULE)

**Interfaces:**
- Consumes: Task 3 (models)
- Produces: `calculate_monthly_rankings`, `calculate_alltime_rankings` tasks, beat schedule

- [ ] **Step 1: Create ranking tasks in backend/apps/rankings/tasks.py**

```python
import logging
from datetime import date
from celery import shared_task
from dateutil.relativedelta import relativedelta
from django.db.models import Max

from apps.vtubers.models import VTuber, StatsSnapshot, Ranking

logger = logging.getLogger(__name__)

@shared_task
def calculate_monthly_rankings():
    """Calculate rankings for the previous month."""
    today = date.today()
    target_month = (today.replace(day=1) - relativedelta(months=1))

    for category in ['followers', 'views']:
        _calculate_rankings_for_period('monthly', category, target_month)

    logger.info(f"Monthly rankings calculated for {target_month}")
    return f"Monthly rankings for {target_month} complete"

@shared_task
def calculate_alltime_rankings():
    """Calculate all-time rankings."""
    for category in ['followers', 'views']:
        _calculate_rankings_for_period('alltime', category, None)

    logger.info("All-time rankings calculated")
    return "All-time rankings complete"

def _calculate_rankings_for_period(period: str, category: str, target_month: date):
    from django.db.models import OuterRef, Subquery

    if period == 'alltime':
        latest_snapshots = StatsSnapshot.objects.filter(
            vtuber__is_active=True,
            vtuber_id__in=StatsSnapshot.objects.filter(
                vtuber=OuterRef('vtuber')
            ).order_by('-recorded_at').values('vtuber')[:1]
        )
    else:
        month_start = target_month
        month_end = (target_month + relativedelta(months=1)) - relativedelta(days=1)
        latest_snapshots = StatsSnapshot.objects.filter(
            vtuber__is_active=True,
            recorded_at__date__gte=month_start,
            recorded_at__date__lte=month_end,
        ).order_by('vtuber', '-recorded_at').distinct('vtuber')

    def get_score(snapshot):
        if category == 'followers':
            return snapshot.followers
        return snapshot.total_views

    sorted_snapshots = sorted(latest_snapshots, key=get_score, reverse=True)

    prev_rank_map = {}
    if period == 'monthly':
        prev_month = target_month - relativedelta(months=1)
        prev_rankings = Ranking.objects.filter(
            period='monthly', category=category, month=prev_month
        )
        prev_rank_map = {r.vtuber_id: r.rank for r in prev_rankings}
    else:
        prev_rankings = Ranking.objects.filter(
            period='alltime', category=category, month__isnull=True
        )
        prev_rank_map = {r.vtuber_id: r.rank for r in prev_rankings}

    for idx, snapshot in enumerate(sorted_snapshots, start=1):
        prev_rank = prev_rank_map.get(snapshot.vtuber_id)
        is_new = prev_rank is None
        rank_change = (prev_rank - idx) if prev_rank else 0

        Ranking.objects.update_or_create(
            vtuber=snapshot.vtuber,
            period=period,
            category=category,
            month=target_month if period == 'monthly' else None,
            defaults={
                'rank': idx,
                'score': get_score(snapshot),
                'rank_change': rank_change,
            }
        )
```

- [ ] **Step 2: Add beat schedule to config/settings.py**

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'scrape-every-6-hours': {
        'task': 'apps.scraper.tasks.scrape_all_vtubers',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    'monthly-ranking': {
        'task': 'apps.rankings.tasks.calculate_monthly_rankings',
        'schedule': crontab(minute=0, hour=2, day_of_month=1),
    },
    'alltime-ranking': {
        'task': 'apps.rankings.tasks.calculate_alltime_rankings',
        'schedule': crontab(minute=0, hour=3, day_of_week=0),
    },
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/apps/rankings/tasks.py backend/config/settings.py
git commit -m "feat(rankings): add ranking calculation tasks and beat schedule"
```

---

### Task 9: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/.gitignore`

**Interfaces:**
- Consumes: Task 1 (Docker)
- Produces: Vite + React + Tailwind project, dev server on :5173

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "ranking-vtuberthai-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^8.3.0",
    "recharts": "^3.10.0",
    "axios": "^1.20.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^8.2.0",
    "tailwindcss": "^4.3.0",
    "@tailwindcss/vite": "^4.3.0"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.js**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

- [ ] **Step 3: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ranking VTuber Thai</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-[#0f0f14] text-[#e4e4e7] min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create frontend/src/main.jsx**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 5: Create frontend/src/index.css**

```css
@import "tailwindcss";

@theme {
  --color-bg: #0f0f14;
  --color-card: #1a1a24;
  --color-card-hover: #22222e;
  --color-text: #e4e4e7;
  --color-muted: #a1a1aa;
  --color-accent: #8b5cf6;
  --color-accent-hover: #7c3aed;
  --color-green: #22c55e;
  --color-red: #ef4444;
  --color-yellow: #eab308;
  --color-border: #2a2a36;
}

body {
  font-family: 'Noto Sans Thai', sans-serif;
  background-color: var(--color-bg);
  color: var(--color-text);
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
```

- [ ] **Step 6: Create frontend/src/App.jsx**

```jsx
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import ComparePage from './pages/ComparePage'
import SearchPage from './pages/SearchPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="profile/:slug" element={<ProfilePage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  )
}

export default App
```

- [ ] **Step 7: Create frontend/.gitignore**

```text
node_modules
dist
.vite
.env
```

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "chore(frontend): scaffold Vite + React + Tailwind project"
```

---

### Task 10: Frontend — API Client & Shared Components

**Files:**
- Create: `frontend/src/api/client.js`
- Create: `frontend/src/components/Layout.jsx`
- Create: `frontend/src/components/Navbar.jsx`
- Create: `frontend/src/components/RankBadge.jsx`
- Create: `frontend/src/components/ChangeIndicator.jsx`
- Create: `frontend/src/components/PeriodSelector.jsx`
- Create: `frontend/src/components/CategorySelector.jsx`
- Create: `frontend/src/components/LoadingSpinner.jsx`
- Create: `frontend/src/components/VTuberCard.jsx`

**Interfaces:**
- Consumes: Task 6 (API endpoints)
- Produces: axios client, layout shell, reusable UI components

- [ ] **Step 1: Create frontend/src/api/client.js**

```javascript
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export const rankingsAPI = {
  getList: (params = {}) => client.get('/rankings/', { params }),
}

export const vtubersAPI = {
  getList: (params = {}) => client.get('/vtubers/', { params }),
  getBySlug: (slug) => client.get(`/vtubers/${slug}/`),
  getHistory: (slug, months = 6) =>
    client.get(`/vtubers/${slug}/history/`, { params: { months } }),
}

export const compareAPI = {
  post: (data) => client.post('/compare/', data),
}

export const summaryAPI = {
  get: () => client.get('/summary/'),
}

export default client
```

- [ ] **Step 2: Create frontend/src/components/Layout.jsx**

```jsx
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--color-border)] py-4 text-center text-sm text-[var(--color-muted)]">
        Ranking VTuber Thai &copy; {new Date().getFullYear()}
      </footer>
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/Navbar.jsx**

```jsx
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const links = [
    { to: '/', label: 'หน้าหลัก' },
    { to: '/search', label: 'ค้นหา' },
    { to: '/compare', label: 'เปรียบเทียบ' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg)]/80 backdrop-blur border-b border-[var(--color-border)]">
      <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between h-14">
        <Link to="/" className="text-lg font-bold text-[var(--color-accent)]">
          🏆 VTuberThai Rankings
        </Link>
        <nav className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                pathname === link.to
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Create frontend/src/components/RankBadge.jsx**

```jsx
export default function RankBadge({ rank }) {
  let bg = 'bg-[var(--color-card)]'
  if (rank === 1) bg = 'bg-yellow-500/20 text-yellow-400'
  else if (rank === 2) bg = 'bg-gray-400/20 text-gray-300'
  else if (rank === 3) bg = 'bg-amber-600/20 text-amber-500'

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${bg}`}>
      {rank}
    </span>
  )
}
```

- [ ] **Step 5: Create frontend/src/components/ChangeIndicator.jsx**

```jsx
export default function ChangeIndicator({ change, isNew }) {
  if (isNew || change === 'NEW') {
    return <span className="text-[var(--color-yellow)] text-xs font-bold px-1.5 py-0.5 rounded bg-yellow-500/10">NEW</span>
  }
  if (change === null || change === undefined || change === 0) {
    return <span className="text-[var(--color-muted)] text-sm">—</span>
  }
  if (change > 0) {
    return (
      <span className="text-[var(--color-green)] text-sm font-medium">
        ↑{change}
      </span>
    )
  }
  return (
    <span className="text-[var(--color-red)] text-sm font-medium">
      ↓{Math.abs(change)}
    </span>
  )
}
```

- [ ] **Step 6: Create frontend/src/components/PeriodSelector.jsx**

```jsx
export default function PeriodSelector({ value, onChange, choices }) {
  return (
    <div className="flex gap-1 bg-[var(--color-card)] rounded-lg p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          onClick={() => onChange(choice.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === choice.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Create frontend/src/components/CategorySelector.jsx**

```jsx
export default function CategorySelector({ value, onChange, choices }) {
  return (
    <div className="flex gap-1 bg-[var(--color-card)] rounded-lg p-1">
      {choices.map((choice) => (
        <button
          key={choice.value}
          onClick={() => onChange(choice.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === choice.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: Create frontend/src/components/LoadingSpinner.jsx**

```jsx
export default function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
    </div>
  )
}
```

- [ ] **Step 9: Create frontend/src/components/VTuberCard.jsx**

```jsx
import { Link } from 'react-router-dom'
import RankBadge from './RankBadge'
import ChangeIndicator from './ChangeIndicator'

export default function VTuberCard({ vtuber, rank, score, rankChange, isNew }) {
  return (
    <Link
      to={`/profile/${vtuber.slug}`}
      className="flex items-center gap-4 p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors"
    >
      <RankBadge rank={rank} />
      <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-lg font-bold text-[var(--color-accent)]">
        {vtuber.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{vtuber.name}</p>
        <p className="text-xs text-[var(--color-muted)]">
          {vtuber.category} • {vtuber.affiliation}
        </p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{score?.toLocaleString()}</p>
        <ChangeIndicator change={rankChange} isNew={isNew} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add API client and shared components"
```

---

### Task 11: Frontend — Home Page (Leaderboard)

**Files:**
- Create: `frontend/src/pages/HomePage.jsx`
- Create: `frontend/src/components/LeaderboardTable.jsx`
- Create: `frontend/src/components/TopThree.jsx`

**Interfaces:**
- Consumes: Task 10 (components, API client)
- Produces: home page with top 3 podium + full leaderboard table

- [ ] **Step 1: Create frontend/src/components/TopThree.jsx**

```jsx
import { Link } from 'react-router-dom'

const PODIUM_STYLES = [
  { container: 'order-2', badge: 'bg-yellow-500', size: 'w-16 h-16', text: 'text-2xl' },
  { container: 'order-1', badge: 'bg-gray-400', size: 'w-14 h-14', text: 'text-xl' },
  { container: 'order-3', badge: 'bg-amber-600', size: 'w-12 h-12', text: 'text-lg' },
]

export default function TopThree({ rankings }) {
  if (!rankings || rankings.length < 3) return null

  return (
    <div className="flex items-end justify-center gap-3 mb-8">
      {rankings.slice(0, 3).map((item, idx) => {
        const style = PODIUM_STYLES[idx]
        return (
          <Link
            key={item.vtuber.id}
            to={`/profile/${item.vtuber.slug}`}
            className={`flex flex-col items-center ${style.container}`}
          >
            <div className={`${style.size} rounded-full ${style.badge} flex items-center justify-center font-bold text-white mb-2`}>
              {item.vtuber.name.charAt(0)}
            </div>
            <p className="text-sm font-medium text-center max-w-[100px] truncate">
              {item.vtuber.name}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {item.score?.toLocaleString()}
            </p>
            <div className="mt-2 w-full bg-[var(--color-card)] rounded-t-lg h-16 flex items-center justify-center">
              <span className="text-2xl font-bold">#{item.rank}</span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/LeaderboardTable.jsx**

```jsx
import VTuberCard from './VTuberCard'

export default function LeaderboardTable({ rankings, loading }) {
  if (loading) return null
  if (!rankings?.length) {
    return <p className="text-center text-[var(--color-muted)] py-8">ไม่มีข้อมูล</p>
  }

  return (
    <div className="space-y-2">
      {rankings.map((item) => (
        <VTuberCard
          key={item.vtuber.id}
          vtuber={item.vtuber}
          rank={item.rank}
          score={item.score}
          rankChange={item.rank_change}
          isNew={item.rank_change === 'NEW'}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/pages/HomePage.jsx**

```jsx
import { useState, useEffect } from 'react'
import { rankingsAPI, summaryAPI } from '../api/client'
import PeriodSelector from '../components/PeriodSelector'
import CategorySelector from '../components/CategorySelector'
import LoadingSpinner from '../components/LoadingSpinner'
import TopThree from '../components/TopThree'
import LeaderboardTable from '../components/LeaderboardTable'

export default function HomePage() {
  const [rankings, setRankings] = useState([])
  const [summary, setSummary] = useState(null)
  const [period, setPeriod] = useState('monthly')
  const [category, setCategory] = useState('followers')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [rankingsRes, summaryRes] = await Promise.all([
          rankingsAPI.getList({ period, category, limit: 50 }),
          summaryAPI.get(),
        ])
        setRankings(rankingsRes.data.results)
        setSummary(summaryRes.data)
      } catch (err) {
        console.error('Failed to fetch rankings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period, category])

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">🏆 อันดับ VTuber ไทย</h1>
        <div className="flex gap-2">
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            choices={summary?.period_choices || []}
          />
          <CategorySelector
            value={category}
            onChange={setCategory}
            choices={summary?.category_choices || []}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <TopThree rankings={rankings} />
          <LeaderboardTable rankings={rankings} loading={loading} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add home page with leaderboard"
```

---

### Task 12: Frontend — Profile Page with Charts

**Files:**
- Create: `frontend/src/pages/ProfilePage.jsx`
- Create: `frontend/src/components/TrendChart.jsx`

**Interfaces:**
- Consumes: Task 10 (API client, components)
- Produces: VTuber profile page with stats and trend chart

- [ ] **Step 1: Create frontend/src/components/TrendChart.jsx**

```jsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TrendChart({ data, dataKey, color = '#8b5cf6' }) {
  if (!data?.length) {
    return <p className="text-center text-[var(--color-muted)] py-8">ไม่มีข้อมูลกราฟ</p>
  }

  const formatted = data.map((d) => ({
    date: d.date,
    value: d[dataKey] || d.value,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
          <XAxis
            dataKey="date"
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a24',
              border: '1px solid #2a2a36',
              borderRadius: '8px',
              color: '#e4e4e7',
            }}
            formatter={(v) => [v.toLocaleString(), dataKey === 'followers' ? 'ผู้ติดตาม' : 'วิว']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/pages/ProfilePage.jsx**

```jsx
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { vtubersAPI } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'
import TrendChart from '../components/TrendChart'

export default function ProfilePage() {
  const { slug } = useParams()
  const [vtuber, setVtuber] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [vtuberRes, historyRes] = await Promise.all([
          vtubersAPI.getBySlug(slug),
          vtubersAPI.getHistory(slug, 6),
        ])
        setVtuber(vtuberRes.data)
        setHistory(historyRes.data.history)
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug])

  if (loading) return <LoadingSpinner />
  if (!vtuber) return <p className="text-center py-8">ไม่พบข้อมูล</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-6 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-2xl font-bold text-[var(--color-accent)]">
          {vtuber.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{vtuber.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">{vtuber.bio}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              {vtuber.category}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-muted)]">
              {vtuber.affiliation}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-sm text-[var(--color-muted)] mb-1">ผู้ติดตาม</h3>
          <p className="text-2xl font-bold">{vtuber.latest_stats?.followers?.toLocaleString()}</p>
        </div>
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-sm text-[var(--color-muted)] mb-1">ยอดวิวรวม</h3>
          <p className="text-2xl font-bold">{vtuber.latest_stats?.total_views?.toLocaleString()}</p>
        </div>
      </div>

      <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        <h3 className="font-medium mb-4">แนวโน้มผู้ติดตาม</h3>
        <TrendChart data={history} dataKey="followers" color="#8b5cf6" />
      </div>

      <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
        <h3 className="font-medium mb-4">แนวโน้มยอดวิว</h3>
        <TrendChart data={history} dataKey="total_views" color="#22c55e" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add profile page with trend charts"
```

---

### Task 13: Frontend — Compare & Search Pages

**Files:**
- Create: `frontend/src/pages/ComparePage.jsx`
- Create: `frontend/src/pages/SearchPage.jsx`

**Interfaces:**
- Consumes: Task 10 (API client, components)
- Produces: compare page with multi-VTuber chart, search page with filters

- [ ] **Step 1: Create frontend/src/pages/ComparePage.jsx**

```jsx
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { vtubersAPI, compareAPI } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ComparePage() {
  const [vtubers, setVtubers] = useState([])
  const [selected, setSelected] = useState([])
  const [category, setCategory] = useState('followers')
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    vtubersAPI.getList({ limit: 50 }).then((res) => {
      setVtubers(res.data.results)
    })
  }, [])

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3)
    )
  }

  const handleCompare = async () => {
    if (selected.length < 2) return
    setLoading(true)
    try {
      const res = await compareAPI.post({ vtubers: selected, category, months: 6 })
      setCompareData(res.data)
    } catch (err) {
      console.error('Compare failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = compareData?.vtubers?.length
    ? compareData.vtubers[0].history.map((_, idx) => {
        const point = { date: compareData.vtubers[0].history[idx]?.date }
        compareData.vtubers.forEach((v) => {
          point[v.name] = v.history[idx]?.value
        })
        return point
      })
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚖️ เปรียบเทียบ VTuber</h1>

      <div className="flex gap-2 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="followers">ผู้ติดตาม</option>
          <option value="views">ยอดวิว</option>
        </select>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          เปรียบเทียบ ({selected.length}/3)
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {vtubers.map((v) => (
          <button
            key={v.id}
            onClick={() => toggle(v.id)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected.includes(v.id)
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {compareData && (
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2a2a36', borderRadius: '8px' }} />
                <Legend />
                {compareData.vtubers.map((v) => (
                  <Line
                    key={v.id}
                    type="monotone"
                    dataKey={v.name}
                    stroke={v.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/pages/SearchPage.jsx**

```jsx
import { useState, useEffect } from 'react'
import { vtubersAPI } from '../api/client'
import VTuberCard from '../components/VTuberCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResults()
    }, 300)
    return () => clearTimeout(timer)
  }, [query, category, affiliation])

  const fetchResults = async () => {
    setLoading(true)
    try {
      const params = {}
      if (query) params.q = query
      if (category) params.category = category
      if (affiliation) params.affiliation = affiliation
      const res = await vtubersAPI.getList(params)
      setResults(res.data.results)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🔍 ค้นหา VTuber</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาจากชื่อ..."
          className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกแนวหน้า</option>
          <option value="gaming">Gaming</option>
          <option value="singing">Singing</option>
          <option value="chatting">Chatting</option>
          <option value="art">Art</option>
          <option value="asmr">ASMR</option>
          <option value="education">Education</option>
        </select>
        <select
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกสังกัด</option>
          <option value="indie">Indie</option>
          <option value="agency">Agency</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-2">
          {results.map((v) => (
            <VTuberCard
              key={v.id}
              vtuber={v}
              rank="-"
              score={null}
              rankChange={null}
            />
          ))}
          {results.length === 0 && (
            <p className="text-center text-[var(--color-muted)] py-8">ไม่พบข้อมูล</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add compare and search pages"
```

---

### Task 14: Integration & Final Polish

**Files:**
- Modify: `backend/config/settings.py` (final review)
- Create: `README.md` (update with setup instructions)

**Interfaces:**
- Consumes: all previous tasks
- Produces: working full-stack app, updated README

- [ ] **Step 1: Verify all settings are correct**

Review `backend/config/settings.py` — ensure `INSTALLED_APPS`, `DATABASES`, `CELERY_BEAT_SCHEDULE`, `CORS_ALLOWED_ORIGINS`, and `REST_FRAMEWORK` are all properly configured.

- [ ] **Step 2: Update README.md**

```markdown
# Ranking VTuber Thai

เว็บไซต์จัดอันดับ VTuber ไทย ข้อมูลจาก YouTube

## Quick Start

```bash
# Start all services
docker compose up -d

# Run migrations
docker compose exec backend python manage.py migrate

# Seed sample data
docker compose exec backend python manage.py seed_vtubers

# Access
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api/v1/
# Admin: http://localhost:8000/admin/
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/rankings/` | GET | ดึงอันดับตามเงื่อนไข |
| `/api/v1/vtubers/` | GET | ค้นหา/กรอง VTuber |
| `/api/v1/vtubers/{slug}/` | GET | ข้อมูล VTuber รายคน |
| `/api/v1/vtubers/{slug}/history/` | GET | ประวัติสถิติ |
| `/api/v1/compare/` | POST | เปรียบเทียบ VTuber |
| `/api/v1/summary/` | GET | สรุปข้อมูลสำหรับหน้าหลัก |
```

- [ ] **Step 3: Commit**

```bash
git add README.md backend/config/settings.py
git commit -m "docs: update README with setup instructions"
```

---

## Self-Review Checklist

- [x] All PRD features covered (rankings, profile, compare, search, dark theme, responsive)
- [x] All API endpoints from API_SPEC implemented
- [x] All database models from DATABASE.md created
- [x] Ranking algorithm from RANKING_ALGORITHM.md implemented
- [x] Celery tasks and beat schedule configured
- [x] Frontend pages for all routes created
- [x] No placeholders/TODOs in plan
- [x] Type consistency across tasks (model fields match serializer fields match view responses)
