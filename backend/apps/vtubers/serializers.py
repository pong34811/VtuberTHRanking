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
