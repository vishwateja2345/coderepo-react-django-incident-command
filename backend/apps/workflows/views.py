from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth

from . import services
from .schema import validate_create_template, validate_template_filters, validate_toggle_step, validate_update_template


@api_view(["GET", "POST"])
@require_auth
def templates(request):
    if request.method == "POST":
        return Response({"data": services.create_template(validate_create_template(request.data))}, status=201)

    query = validate_template_filters(request.query_params)

    return Response({"data": services.list_templates(query["service_id"])})


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
def template(request, template_id):
    if request.method == "PATCH":
        return Response({"data": services.update_template(template_id, validate_update_template(request.data))})

    if request.method == "DELETE":
        services.delete_template(template_id)

        return Response(status=204)

    return Response({"data": services.get_template(template_id)})


@api_view(["GET"])
@require_auth
def incident_workflow(request, incident_id):
    return Response({"data": services.get_for_incident(incident_id)})


@api_view(["PATCH"])
@require_auth
def workflow_step(request, instance_id, order):
    return Response({"data": services.toggle_step(instance_id, order, validate_toggle_step(request.data)["done"], request.responder)})
