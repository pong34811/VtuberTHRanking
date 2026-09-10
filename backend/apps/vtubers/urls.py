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
