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
