from django.urls import path

from . import views

urlpatterns = [
    path("services", views.service_list),
    path("services/<str:service_id>", views.service_detail),
    path("services/<str:service_id>/rotate-key", views.rotate_integration_key),
]
