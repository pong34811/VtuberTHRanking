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

        month_date = None
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
            'month': month_date.isoformat() if period == 'monthly' and month_date else None,
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
