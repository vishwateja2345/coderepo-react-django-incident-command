from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth

from . import services
from .schema import validate_range


@api_view(["GET"])
@require_auth
def analytics_summary(request):
    values = validate_range(request.query_params)
    from_moment, to_moment = services.resolve_range(values)

    return Response({"data": services.summary(from_moment, to_moment)})


@api_view(["GET"])
@require_auth
def analytics_by_service(request):
    values = validate_range(request.query_params)
    from_moment, to_moment = services.resolve_range(values)

    return Response({"data": services.by_service(from_moment, to_moment)})


@api_view(["GET"])
@require_auth
def analytics_by_responder(request):
    values = validate_range(request.query_params)
    from_moment, to_moment = services.resolve_range(values)

    return Response({"data": services.by_responder(from_moment, to_moment)})


@api_view(["GET"])
@require_auth
def analytics_trend(request):
    values = validate_range(request.query_params)
    from_moment, to_moment = services.resolve_range(values)

    return Response({"data": services.trend(from_moment, to_moment)})
