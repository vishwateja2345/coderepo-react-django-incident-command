import functools

from apps.auth import services as auth_service

from .errors import AppError

BEARER_PREFIX = "Bearer "


def read_token(request):
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith(BEARER_PREFIX):
        raise AppError(401, "AUTH_REQUIRED", "Sign in to the incident workspace to continue.")

    token = authorization[len(BEARER_PREFIX) :].strip()

    if not token:
        raise AppError(401, "AUTH_REQUIRED", "Sign in to the incident workspace to continue.")

    return token


def require_auth(view):
    """Attach the authenticated responder to the request, or raise 401."""

    @functools.wraps(view)
    def wrapper(request, *args, **kwargs):
        request.responder = auth_service.authenticate(read_token(request))
        request.responder_id = str(request.responder["_id"])

        return view(request, *args, **kwargs)

    return wrapper


def require_role(*roles):
    """Restrict a view to responders whose role is one of ``roles``. Compose after ``require_auth``."""

    def decorator(view):
        @functools.wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.responder.get("role") not in roles:
                raise AppError(403, "FORBIDDEN", "You do not have permission to perform this action.")

            return view(request, *args, **kwargs)

        return wrapper

    return decorator
