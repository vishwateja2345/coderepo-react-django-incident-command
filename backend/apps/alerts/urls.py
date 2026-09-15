from django.urls import path

from . import views

urlpatterns = [
    path("events/<str:integration_key>", views.ingest),
    path("alerts", views.alert_list),
    path("alerts/<str:event_id>", views.alert_detail),
]
