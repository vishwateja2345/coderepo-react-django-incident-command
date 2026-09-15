from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.shared.authentication import require_auth

from . import services


@api_view(["GET"])
@require_auth
def statuspage_overview(request):
    return Response({"data": services.overview()})
