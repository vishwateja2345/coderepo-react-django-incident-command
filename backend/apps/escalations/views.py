from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth
from apps.shared.errors import AppError

from . import services
from .schema import validate_create, validate_update


def require_admin(request):
    if request.responder.get("role") != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can manage escalation policies.")


@api_view(["GET", "POST"])
@require_auth
def policies(request):
    if request.method == "POST":
        require_admin(request)

        return Response({"data": services.create_policy(validate_create(request.data))}, status=201)

    return Response({"data": services.list_policies()})


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
def policy(request, policy_id):
    if request.method == "DELETE":
        require_admin(request)
        services.delete_policy(policy_id)

        return Response(status=204)

    if request.method == "PATCH":
        require_admin(request)

        return Response({"data": services.update_policy(policy_id, validate_update(request.data))})

    return Response({"data": services.get_by_id(policy_id)})
