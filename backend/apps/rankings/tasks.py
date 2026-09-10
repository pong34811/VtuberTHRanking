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
