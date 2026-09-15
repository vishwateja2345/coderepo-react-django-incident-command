from apps.incidents import repository as incident_repository
from apps.services import repository as service_repository
from apps.shared.documents import now_utc


def derive_status(open_incidents_for_service):
    if any(incident.get("status") == "triggered" and incident.get("urgency") == "high" for incident in open_incidents_for_service):
        return "major_outage"

    if any(incident.get("urgency") == "high" for incident in open_incidents_for_service):
        return "partial_outage"

    if open_incidents_for_service:
        return "degraded_performance"

    return "operational"


def overview():
    services = service_repository.find_all(active_only=True)
    open_incidents = incident_repository.find_open()
    incidents_by_service = {}

    for incident in open_incidents:
        key = str(incident.get("serviceId"))
        incidents_by_service.setdefault(key, []).append(incident)

    rows = []

    for service in sorted(services, key=lambda item: item.get("name", "")):
        service_id = str(service["_id"])
        service_incidents = incidents_by_service.get(service_id, [])
        rows.append(
            {
                "serviceId": service["_id"],
                "serviceName": service.get("name", ""),
                "status": derive_status(service_incidents),
                "openIncidentCount": len(service_incidents),
            }
        )

    return {"services": rows, "updatedAt": now_utc()}
