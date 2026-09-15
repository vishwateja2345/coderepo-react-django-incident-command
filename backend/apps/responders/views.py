from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth
from apps.shared.errors import AppError

from . import services
from .schema import validate_create, validate_update


@api_view(["GET", "POST"])
@require_auth
def responders(request):
    if request.method == "POST":
        if request.responder.get("role") != "admin":
            raise AppError(403, "FORBIDDEN", "Only an admin can add responders.")

        return Response({"data": services.create_responder(validate_create(request.data))}, status=201)

    include_inactive = request.query_params.get("all") == "true"

    return Response({"data": services.list_responders(active_only=not include_inactive)})


@api_view(["GET", "PATCH"])
@require_auth
def responder(request, responder_id):
    if request.method == "PATCH":
        values = validate_update(request.data)
        is_self = responder_id == request.responder_id
        is_admin = request.responder.get("role") == "admin"
        elevated_fields = {"role", "active"}

        if not is_self and not is_admin:
            raise AppError(403, "FORBIDDEN", "You can only update your own profile.")

        if elevated_fields & values.keys() and not is_admin:
            raise AppError(403, "FORBIDDEN", "Only an admin can change role or active status.")

        return Response({"data": services.update_responder(responder_id, values)})

    return Response({"data": services.get_by_id(responder_id)})
