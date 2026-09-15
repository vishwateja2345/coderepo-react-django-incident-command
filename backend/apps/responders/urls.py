from django.urls import path

from . import views

urlpatterns = [
    path("responders", views.responders),
    path("responders/<str:responder_id>", views.responder),
]
