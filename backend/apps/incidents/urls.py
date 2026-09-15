from django.urls import path

from . import views

urlpatterns = [
    path("incidents", views.incident_list),
    path("incidents/<str:incident_id>", views.incident_detail),
    path("incidents/<str:incident_id>/acknowledge", views.acknowledge),
    path("incidents/<str:incident_id>/assign", views.assign),
    path("incidents/<str:incident_id>/escalate", views.escalate),
    path("incidents/<str:incident_id>/notes", views.notes),
    path("incidents/<str:incident_id>/resolve", views.resolve),
]
