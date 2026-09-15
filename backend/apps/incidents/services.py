from datetime import timedelta

from bson import ObjectId

from apps.escalations import services as escalation_service
from apps.responders import repository as responder_repository
from apps.services import repository as service_repository
from apps.shared.documents import now_utc
from apps.shared.errors import AppError
from apps.shared.validation import is_object_id

from . import repository

INCIDENT_NOT_FOUND_MESSAGE = "This incident no longer exists."
SERVICE_NOT_FOUND_MESSAGE = "Choose a service that exists."
RESPONDER_NOT_FOUND_MESSAGE = "Choose a responder who exists."
ALREADY_RESOLVED_MESSAGE = "This incident has already been resolved."
MAX_ESCALATION_STEPS_PER_TICK = 10


def responder_name(responder_id):
    if responder_id is None:
        return None

    responder = responder_repository.find_by_id(str(responder_id))

    return responder["name"] if responder else "Former responder"


def service_name(service_id):
    service = service_repository.find_by_id(str(service_id))

    return service["name"] if service else "Former service"


def seconds_between(start, end):
    if start is None or end is None:
        return None

    return (end - start).total_seconds()


def decorate(incident):
    return {
        **incident,
        "serviceName": service_name(incident["serviceId"]),
        "assigneeName": responder_name(incident.get("assigneeId")),
        "mttaSeconds": seconds_between(incident["createdAt"], incident.get("acknowledgedAt")),
        "mttrSeconds": seconds_between(incident["createdAt"], incident.get("resolvedAt")),
    }


def timeline_entry(entry_type, message, actor=None, at_moment=None):
    return {
        "type": entry_type,
        "message": message,
        "actorId": ObjectId(actor["_id"]) if actor else None,
        "actorName": actor["name"] if actor else "System",
        "at": at_moment or now_utc(),
    }


def load(incident_id):
    if not is_object_id(incident_id):
        raise AppError(404, "INCIDENT_NOT_FOUND", INCIDENT_NOT_FOUND_MESSAGE)

    incident = repository.find_by_id(incident_id)

    if incident is None:
        raise AppError(404, "INCIDENT_NOT_FOUND", INCIDENT_NOT_FOUND_MESSAGE)

    return incident


def escalation_message(level, responder_id):
    message = f"Escalated to level {level['order']}."

    return f"{message} Assigned to {responder_name(responder_id)}." if responder_id else message


def advance_level(incident, policy, level, actor, at_moment=None):
    moment = at_moment or now_utc()
    responder_id = escalation_service.resolve_target_responder_id(policy, level["order"], moment)
    entry = timeline_entry("escalated", escalation_message(level, responder_id), actor, at_moment=moment)
    extra_set = {"currentLevel": level["order"], "lastEscalatedAt": moment}

    if responder_id:
        extra_set["assigneeId"] = responder_id

    updated = repository.advance_escalation_level(str(incident["_id"]), incident.get("currentLevel", 0), entry, extra_set)

    # A concurrent request (or a duplicate read from the same client) already advanced this incident
    # past the level we read; fall back to the current stored state instead of double-pushing the entry.
    return updated if updated is not None else repository.find_by_id(str(incident["_id"]))


def apply_escalation_tick(incident):
    """Advance a triggered incident through every escalation level whose timeout has elapsed. Runs on
    every read since this environment has no background worker or websocket channel to drive escalation
    out-of-band. Each overdue level advances the anchor by its own timeout (the scheduled due time) rather
    than to wall-clock now, so an incident that has sat untouched for a while catches up through every
    level it should have already passed, with historically accurate timeline timestamps."""
    if incident["status"] != "triggered" or not incident.get("escalationPolicyId"):
        return incident

    try:
        policy = escalation_service.load(str(incident["escalationPolicyId"]))
    except AppError:
        return incident

    total_levels = escalation_service.level_count(policy)
    current = incident
    steps = 0
    anchor = current.get("lastEscalatedAt") or current["createdAt"]
    now = now_utc()

    while steps < MAX_ESCALATION_STEPS_PER_TICK and current["status"] == "triggered" and current.get("currentLevel", 0) < total_levels:
        level = escalation_service.get_level(policy, current.get("currentLevel", 0) + 1)

        if level is None:
            break

        if (now - anchor).total_seconds() < level["timeoutMinutes"] * 60:
            break

        anchor = anchor + timedelta(minutes=level["timeoutMinutes"])
        previous_level = current.get("currentLevel", 0)
        current = advance_level(current, policy, level, None, at_moment=anchor)

        if current.get("currentLevel", 0) == previous_level:
            break  # a concurrent request already handled this escalation; stop and let the next read continue

        steps += 1

    return current


def list_incidents(filters):
    incidents = [apply_escalation_tick(incident) for incident in repository.find_all(filters)]

    return [decorate(incident) for incident in incidents]


def get_by_id(incident_id):
    return decorate(apply_escalation_tick(load(incident_id)))


def ensure_service(service_id):
    service = service_repository.find_by_id(service_id)

    if service is None:
        raise AppError(422, "SERVICE_NOT_FOUND", SERVICE_NOT_FOUND_MESSAGE)

    return service


def initial_assignment(service):
    if not service.get("escalationPolicyId"):
        return None, None

    try:
        policy = escalation_service.load(str(service["escalationPolicyId"]))
    except AppError:
        return None, None

    if escalation_service.level_count(policy) == 0:
        return None, None

    return escalation_service.resolve_target_responder_id(policy, 1, now_utc()), policy


def instantiate_workflow(service, incident_id):
    if not service.get("workflowTemplateId"):
        return

    from apps.workflows import services as workflow_service

    try:
        workflow_service.instantiate_for_incident(str(service["workflowTemplateId"]), incident_id)
    except AppError:
        pass


def build_incident_fields(service, title, description, urgency, opening_message, actor):
    assignee_id, policy = initial_assignment(service)
    moment = now_utc()

    return {
        "service_id": service["_id"],
        "title": title,
        "description": description,
        "urgency": urgency or service.get("defaultUrgency", "high"),
        "assignee_id": assignee_id,
        "escalation_policy_id": service.get("escalationPolicyId"),
        "current_level": 1 if assignee_id else 0,
        "last_escalated_at": moment if assignee_id else None,
        "timeline": [timeline_entry("triggered", opening_message, actor)],
    }


def create_incident(values, actor):
    service = ensure_service(values["service_id"])
    message = f"Incident opened by {actor['name']}." if actor else "Incident opened."
    fields = build_incident_fields(service, values["title"], values.get("description", ""), values.get("urgency"), message, actor)
    created = repository.create(fields)
    instantiate_workflow(service, str(created["_id"]))

    return decorate(created)


def create_from_event(service, summary, source):
    message = f'Triggered by a {source} alert: "{summary}"'
    fields = build_incident_fields(service, summary, f"Automatically opened from a {source} alert.", None, message, None)
    created = repository.create(fields)
    instantiate_workflow(service, str(created["_id"]))

    return created


def update_incident(incident_id, values):
    load(incident_id)

    return decorate(repository.set_fields(incident_id, values))


def acknowledge(incident_id, actor):
    incident = load(incident_id)

    if incident["status"] == "resolved":
        raise AppError(409, "INCIDENT_RESOLVED", ALREADY_RESOLVED_MESSAGE)

    if incident["status"] == "acknowledged":
        return decorate(incident)

    entry = timeline_entry("acknowledged", f"Acknowledged by {actor['name']}.", actor)
    updated = repository.push_timeline(incident_id, entry, {"status": "acknowledged", "acknowledgedAt": now_utc()})

    return decorate(updated)


def assign(incident_id, responder_id, actor):
    load(incident_id)

    if responder_repository.find_by_id(responder_id) is None:
        raise AppError(422, "RESPONDER_NOT_FOUND", RESPONDER_NOT_FOUND_MESSAGE)

    entry = timeline_entry("assigned", f"Assigned to {responder_name(ObjectId(responder_id))} by {actor['name']}.", actor)
    updated = repository.push_timeline(incident_id, entry, {"assigneeId": ObjectId(responder_id)})

    return decorate(updated)


def escalate(incident_id, actor):
    incident = load(incident_id)

    if incident["status"] != "triggered":
        raise AppError(409, "INCIDENT_NOT_ESCALATABLE", "Only a triggered, unacknowledged incident can be escalated.")

    if not incident.get("escalationPolicyId"):
        raise AppError(422, "NO_ESCALATION_POLICY", "This incident's service has no escalation policy.")

    policy = escalation_service.load(str(incident["escalationPolicyId"]))
    next_order = incident.get("currentLevel", 0) + 1
    level = escalation_service.get_level(policy, next_order)

    if level is None:
        raise AppError(409, "ESCALATION_EXHAUSTED", "This incident has already reached the final escalation level.")

    return decorate(advance_level(incident, policy, level, actor))


def add_note(incident_id, message, actor, customer_facing):
    load(incident_id)
    entry = timeline_entry("status_update" if customer_facing else "note", message, actor)
    updated = repository.push_timeline(incident_id, entry, {})

    return decorate(updated)


def resolve(incident_id, actor):
    incident = load(incident_id)

    if incident["status"] == "resolved":
        return decorate(incident)

    entry = timeline_entry("resolved", f"Resolved by {actor['name']}.", actor)
    updated = repository.push_timeline(incident_id, entry, {"status": "resolved", "resolvedAt": now_utc()})

    return decorate(updated)


def append_timeline(incident_id, entry_type, message, actor=None):
    repository.push_timeline(incident_id, timeline_entry(entry_type, message, actor), {})
