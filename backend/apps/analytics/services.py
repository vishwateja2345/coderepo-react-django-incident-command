from datetime import timedelta

from apps.incidents import repository as incident_repository
from apps.responders import services as responder_service
from apps.services import repository as service_repository
from apps.shared.documents import now_utc

BUCKET_DAYS = 7
UNKNOWN_RESPONDER_NAME = "Unknown responder"
UNKNOWN_SERVICE_NAME = "Unknown service"


def resolve_range(query):
    to_moment = query.get("to") or now_utc()
    from_moment = query.get("from") or to_moment - timedelta(days=90)

    return from_moment, to_moment


def seconds_between(a, b):
    if a is None or b is None:
        return None

    return (b - a).total_seconds()


def average(values):
    return sum(values) / len(values) if values else None


def incident_metrics(incidents):
    mtta_values = [value for value in (seconds_between(item.get("createdAt"), item.get("acknowledgedAt")) for item in incidents) if value is not None]
    mttr_values = [value for value in (seconds_between(item.get("createdAt"), item.get("resolvedAt")) for item in incidents) if value is not None]

    return average(mtta_values), average(mttr_values)


def incidents_in_range(from_moment, to_moment):
    if from_moment >= to_moment:
        return []

    return incident_repository.find_for_analytics(from_moment, to_moment)


def summary(from_moment, to_moment):
    incidents = incidents_in_range(from_moment, to_moment)
    avg_mtta_seconds, avg_mttr_seconds = incident_metrics(incidents)

    return {
        "totalIncidents": len(incidents),
        "openCount": sum(1 for incident in incidents if incident.get("status") != "resolved"),
        "resolvedCount": sum(1 for incident in incidents if incident.get("status") == "resolved"),
        "avgMttaSeconds": avg_mtta_seconds,
        "avgMttrSeconds": avg_mttr_seconds,
    }


def group_by(items, key_name):
    grouped = {}

    for item in items:
        key = item.get(key_name)

        if key is None:
            continue

        entry = grouped.setdefault(str(key), {"id": key, "items": []})
        entry["items"].append(item)

    return grouped


def by_service(from_moment, to_moment):
    incidents = incidents_in_range(from_moment, to_moment)
    grouped = group_by(incidents, "serviceId")
    services = service_repository.find_existing(grouped.keys()) if grouped else []
    names_by_id = {str(service["_id"]): service.get("name", UNKNOWN_SERVICE_NAME) for service in services}
    rows = []

    for key, group in grouped.items():
        avg_mtta_seconds, avg_mttr_seconds = incident_metrics(group["items"])
        rows.append(
            {
                "serviceId": group["id"],
                "serviceName": names_by_id.get(key, UNKNOWN_SERVICE_NAME),
                "incidentCount": len(group["items"]),
                "avgMttaSeconds": avg_mtta_seconds,
                "avgMttrSeconds": avg_mttr_seconds,
            }
        )

    return sorted(rows, key=lambda row: (-row["incidentCount"], row["serviceName"], row["serviceId"]))


def by_responder(from_moment, to_moment):
    incidents = incidents_in_range(from_moment, to_moment)
    grouped = group_by(incidents, "assigneeId")
    responders = responder_service.find_existing(grouped.keys()) if grouped else []
    names_by_id = {str(responder["_id"]): responder.get("name", UNKNOWN_RESPONDER_NAME) for responder in responders}
    rows = []

    for key, group in grouped.items():
        avg_mtta_seconds, avg_mttr_seconds = incident_metrics(group["items"])
        rows.append(
            {
                "responderId": group["id"],
                "responderName": names_by_id.get(key, UNKNOWN_RESPONDER_NAME),
                "incidentCount": len(group["items"]),
                "avgMttaSeconds": avg_mtta_seconds,
                "avgMttrSeconds": avg_mttr_seconds,
            }
        )

    return sorted(rows, key=lambda row: (-row["incidentCount"], row["responderName"], row["responderId"]))


def trend(from_moment, to_moment):
    incidents = incidents_in_range(from_moment, to_moment)
    rows = []
    bucket_start = from_moment

    while bucket_start < to_moment:
        bucket_end = min(bucket_start + timedelta(days=BUCKET_DAYS), to_moment)
        bucket_incidents = [
            incident
            for incident in incidents
            if bucket_start <= incident.get("createdAt") < bucket_end
        ]
        avg_mtta_seconds, avg_mttr_seconds = incident_metrics(bucket_incidents)
        rows.append(
            {
                "bucketStart": bucket_start,
                "bucketEnd": bucket_end,
                "incidentCount": len(bucket_incidents),
                "avgMttaSeconds": avg_mtta_seconds,
                "avgMttrSeconds": avg_mttr_seconds,
            }
        )
        bucket_start = bucket_end

    return rows
