from django.urls import path

from . import views

urlpatterns = [
    path("escalation-policies", views.policies),
    path("escalation-policies/<str:policy_id>", views.policy),
]
