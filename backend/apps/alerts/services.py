from datetime import timedelta

from bson import ObjectId
from django.conf import settings

from apps.incidents import repository as incident_repository
from apps.incidents import services as incident_service
from apps.services import repository as service_repository
from apps.shared.documents import now_utc
from apps.shared.errors import AppError
from apps.shared.validation import is_object_id

from . import repository

EVENT_NOT_FOUND_MESSAGE = "This alert no longer exists."
INVALID_INTEGRATION_KEY_MESSAGE = "This integration key does not match an active service."


def public_event(event):
    return {
        "_id": event["_id"],
        "serviceId": event["serviceId"],
        "serviceName": service_name(event["serviceId"]),
        "incidentId": event.get("incidentId"),
        "source": event.get("source", "monitoring"),
        "summary": event["summary"],
        "severity": event.get("severity", "critical"),
        "status": event.get("status", "open"),
        "occurrenceCount": event.get("occurrenceCount", 1),
        "receivedAt": event["receivedAt"],
        "createdAt": event.get("createdAt"),
    }


def service_name(service_id):
    service = service_repository.find_by_id(str(service_id))

    return service["name"] if service else "Former service"


def list_events(filters):
    return [public_event(event) for event in repository.find_all(filters)]


def get_by_id(event_id):
    if not is_object_id(event_id):
        raise AppError(404, "ALERT_NOT_FOUND", EVENT_NOT_FOUND_MESSAGE)

    event = repository.find_by_id(event_id)

    if event is None:
        raise AppError(404, "ALERT_NOT_FOUND", EVENT_NOT_FOUND_MESSAGE)

    return public_event(event)


def normalize_dedup_key(values):
    provided = values.get("dedupKey")

    if provided:
        return provided.strip().lower()

    return f"{values['source']}:{values['summary']}".strip().lower()


def find_grouping_incident(service_id):
    since = now_utc() - timedelta(minutes=settings.ALERT_GROUPING_WINDOW_MINUTES)
    candidates = incident_repository.find_open_for_service_since(service_id, since)

    return candidates[0] if candidates else None


def ingest(integration_key, values):
    service = service_repository.find_by_integration_key(integration_key)

    if service is None:
        raise AppError(401, "INVALID_INTEGRATION_KEY", INVALID_INTEGRATION_KEY_MESSAGE)

    dedup_key = normalize_dedup_key(values)
    dedup_since = now_utc() - timedelta(minutes=settings.ALERT_DEDUP_WINDOW_MINUTES)
    duplicate = repository.find_recent_duplicate(str(service["_id"]), dedup_key, dedup_since)

    if duplicate is not None:
        return public_event(repository.increment_occurrence(str(duplicate["_id"]))), True

    created = repository.create(
        {
            "service_id": service["_id"],
            "source": values["source"],
            "summary": values["summary"],
            "severity": values["severity"],
            "dedup_key": dedup_key,
            "payload": values.get("payload") or {},
            "received_at": now_utc(),
        }
    )

    grouping_incident = find_grouping_incident(str(service["_id"]))

    if grouping_incident is not None:
        incident_repository.add_event_id(str(grouping_incident["_id"]), created["_id"])
        incident_service.append_timeline(
            str(grouping_incident["_id"]), "note", f'Additional alert grouped in: "{values["summary"]}".'
        )
        incident_id = grouping_incident["_id"]
    else:
        incident = incident_service.create_from_event(service, values["summary"], values["source"])
        incident_id = incident["_id"]

    updated_event = repository.attach_to_incident(str(created["_id"]), incident_id)

    return public_event(updated_event), False
