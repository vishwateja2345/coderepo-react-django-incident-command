from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth
from apps.shared.errors import AppError

from . import services
from .schema import validate_create, validate_update


def require_admin(request):
    if request.responder.get("role") != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can manage services.")


@api_view(["GET", "POST"])
@require_auth
def service_list(request):
    if request.method == "POST":
        require_admin(request)

        return Response({"data": services.create_service(validate_create(request.data))}, status=201)

    return Response({"data": services.list_services()})


@api_view(["GET", "PATCH", "DELETE"])
@require_auth
def service_detail(request, service_id):
    if request.method == "DELETE":
        require_admin(request)
        services.delete_service(service_id)

        return Response(status=204)

    if request.method == "PATCH":
        require_admin(request)

        return Response({"data": services.update_service(service_id, validate_update(request.data))})

    return Response({"data": services.get_by_id(service_id)})


@api_view(["POST"])
@require_auth
def rotate_integration_key(request, service_id):
    require_admin(request)

    return Response({"data": services.rotate_key(service_id)})
