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
