from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth

from . import services
from .schema import validate_assign, validate_create, validate_filters, validate_note, validate_update


@api_view(["GET", "POST"])
@require_auth
def incident_list(request):
    if request.method == "POST":
        return Response({"data": services.create_incident(validate_create(request.data), request.responder)}, status=201)

    return Response({"data": services.list_incidents(validate_filters(request.query_params))})


@api_view(["GET", "PATCH"])
@require_auth
def incident_detail(request, incident_id):
    if request.method == "PATCH":
        return Response({"data": services.update_incident(incident_id, validate_update(request.data))})

    return Response({"data": services.get_by_id(incident_id)})


@api_view(["POST"])
@require_auth
def acknowledge(request, incident_id):
    return Response({"data": services.acknowledge(incident_id, request.responder)})


@api_view(["POST"])
@require_auth
def assign(request, incident_id):
    responder_id = validate_assign(request.data)

    return Response({"data": services.assign(incident_id, responder_id, request.responder)})


@api_view(["POST"])
@require_auth
def escalate(request, incident_id):
    return Response({"data": services.escalate(incident_id, request.responder)})


@api_view(["POST"])
@require_auth
def notes(request, incident_id):
    values = validate_note(request.data)

    return Response({"data": services.add_note(incident_id, values["message"], request.responder, values["customer_facing"])}, status=201)


@api_view(["POST"])
@require_auth
def resolve(request, incident_id):
    return Response({"data": services.resolve(incident_id, request.responder)})
