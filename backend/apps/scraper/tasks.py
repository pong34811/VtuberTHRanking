import logging
import random
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
