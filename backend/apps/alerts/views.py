from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth

from . import services
from .schema import validate_filters, validate_ingest


@api_view(["POST"])
def ingest(request, integration_key):
    event, deduplicated = services.ingest(integration_key, validate_ingest(request.data))

    return Response({"data": {**event, "deduplicated": deduplicated}}, status=202)


@api_view(["GET"])
@require_auth
def alert_list(request):
    return Response({"data": services.list_events(validate_filters(request.query_params))})


@api_view(["GET"])
@require_auth
def alert_detail(request, event_id):
    return Response({"data": services.get_by_id(event_id)})
