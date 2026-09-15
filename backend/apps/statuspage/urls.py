from django.urls import path

from . import views

urlpatterns = [
    path("statuspage", views.statuspage_overview),
]
