from django.urls import path

from . import views

urlpatterns = [
    path("schedules", views.schedules),
    path("schedules/<str:schedule_id>", views.schedule),
    path("schedules/<str:schedule_id>/oncall-now", views.oncall_now),
    path("schedules/<str:schedule_id>/shifts", views.shifts),
    path("schedules/<str:schedule_id>/overrides", views.overrides),
    path("schedules/<str:schedule_id>/overrides/<str:override_id>", views.override),
]
