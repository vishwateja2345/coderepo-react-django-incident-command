import secrets

from apps.incidents import repository as incident_repository
from apps.responders import repository as responder_repository
from apps.shared.errors import AppError
from apps.shared.validation import is_object_id

from . import repository
from .constants import INTEGRATION_KEY_BYTES

SERVICE_NOT_FOUND_MESSAGE = "This service no longer exists."
OWNER_NOT_FOUND_MESSAGE = "Choose a responder who exists to own this service."


def generate_integration_key():
    return secrets.token_hex(INTEGRATION_KEY_BYTES)


def derive_status(open_incidents):
    if any(incident.get("status") == "triggered" and incident.get("urgency") == "high" for incident in open_incidents):
        return "major_outage"

    if any(incident.get("urgency") == "high" for incident in open_incidents):
        return "partial_outage"

    if open_incidents:
        return "degraded_performance"

    return "operational"


def owner_name(owner_id):
    owner = responder_repository.find_by_id(str(owner_id))

    return owner["name"] if owner else "Former responder"


def public_service(service, open_incidents=None):
    open_incidents = open_incidents if open_incidents is not None else incident_repository.find_open_for_service(str(service["_id"]))

    return {
        "_id": service["_id"],
        "name": service["name"],
        "description": service.get("description", ""),
        "ownerId": service["ownerId"],
        "ownerName": owner_name(service["ownerId"]),
        "integrationKey": service["integrationKey"],
        "escalationPolicyId": service.get("escalationPolicyId"),
        "workflowTemplateId": service.get("workflowTemplateId"),
        "defaultUrgency": service.get("defaultUrgency", "high"),
        "active": service.get("active", True),
        "status": derive_status(open_incidents),
        "openIncidentCount": len(open_incidents),
        "createdAt": service.get("createdAt"),
    }


def list_services(active_only=False):
    services = repository.find_all(active_only)
    open_incidents = incident_repository.find_open()
    grouped = {}

    for incident in open_incidents:
        grouped.setdefault(str(incident["serviceId"]), []).append(incident)

    return [public_service(service, grouped.get(str(service["_id"]), [])) for service in services]


def load(service_id):
    if not is_object_id(service_id):
        raise AppError(404, "SERVICE_NOT_FOUND", SERVICE_NOT_FOUND_MESSAGE)

    service = repository.find_by_id(service_id)

    if service is None:
        raise AppError(404, "SERVICE_NOT_FOUND", SERVICE_NOT_FOUND_MESSAGE)

    return service


def get_by_id(service_id):
    return public_service(load(service_id))


def ensure_owner_exists(owner_id):
    if responder_repository.find_by_id(owner_id) is None:
        raise AppError(422, "OWNER_NOT_FOUND", OWNER_NOT_FOUND_MESSAGE)


def create_service(values):
    ensure_owner_exists(values["owner_id"])
    created = repository.create({**values, "integration_key": generate_integration_key()})

    return public_service(created)


def update_service(service_id, values):
    load(service_id)

    if "owner_id" in values:
        ensure_owner_exists(values["owner_id"])

    updated = repository.update(service_id, values)

    return public_service(updated)


def delete_service(service_id):
    load(service_id)
    repository.delete(service_id)


def rotate_key(service_id):
    load(service_id)
    updated = repository.update(service_id, {"integration_key": generate_integration_key()})

    return public_service(updated)
