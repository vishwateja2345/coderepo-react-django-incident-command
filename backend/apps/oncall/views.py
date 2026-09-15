from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth
from apps.shared.errors import AppError

from . import services
from .schema import validate_create, validate_override, validate_update


def require_admin(request):
    if request.responder.get("role") != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can manage on-call schedules.")


@api_view(["GET", "POST"])
@require_auth
def schedules(request):
    if request.method == "POST":
        require_admin(request)

        return Response({"data": services.create_schedule(validate_create(request.data))}, status=201)

    return Response({"data": services.list_schedules()})


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
def schedule(request, schedule_id):
    if request.method == "DELETE":
        require_admin(request)
        services.delete_schedule(schedule_id)

        return Response(status=204)

    if request.method == "PATCH":
        require_admin(request)

        return Response({"data": services.update_schedule(schedule_id, validate_update(request.data))})

    return Response({"data": services.get_by_id(schedule_id)})


@api_view(["GET"])
@require_auth
def oncall_now(request, schedule_id):
    schedule_doc = services.get_by_id(schedule_id)

    return Response({"data": {"responderId": schedule_doc["currentResponderId"], "responderName": schedule_doc["currentResponderName"]}})


@api_view(["GET"])
@require_auth
def shifts(request, schedule_id):
    return Response({"data": services.upcoming_shifts(schedule_id)})


@api_view(["GET", "POST"])
@require_auth
def overrides(request, schedule_id):
    if request.method == "POST":
        return Response({"data": services.add_override(schedule_id, validate_override(request.data))}, status=201)

    return Response({"data": services.list_overrides(schedule_id)})


@api_view(["DELETE"])
@require_auth
def override(request, schedule_id, override_id):
    services.remove_override(schedule_id, override_id)

    return Response(status=204)
