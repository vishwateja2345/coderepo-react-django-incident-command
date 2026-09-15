from django.urls import path

from . import views

urlpatterns = [
    path("analytics/summary", views.analytics_summary),
    path("analytics/by-service", views.analytics_by_service),
    path("analytics/by-responder", views.analytics_by_responder),
    path("analytics/trend", views.analytics_trend),
]
