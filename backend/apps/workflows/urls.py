from django.urls import path

from . import views

urlpatterns = [
    path("workflow-templates", views.templates),
    path("workflow-templates/<str:template_id>", views.template),
    path("incidents/<str:incident_id>/workflow", views.incident_workflow),
    path("workflow-instances/<str:instance_id>/steps/<int:order>", views.workflow_step),
]
