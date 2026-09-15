from bson import ObjectId
from pymongo import ReturnDocument

from apps.shared.documents import now_utc
from apps.shared.mongo import collection

from .models import Incident

OPEN_STATUSES = ["triggered", "acknowledged"]
SORT_ORDER = ["-created_at"]


def find_by_id(incident_id):
    if not ObjectId.is_valid(incident_id):
        return None

    return Incident.objects(__raw__={"_id": ObjectId(incident_id)}).as_pymongo().first()


def find_all(filters):
    conditions = {}

    if filters.get("service_id"):
        conditions["serviceId"] = ObjectId(filters["service_id"])

    if filters.get("status"):
        conditions["status"] = filters["status"]

    if filters.get("assignee_id"):
        conditions["assigneeId"] = ObjectId(filters["assignee_id"])

    return list(Incident.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_open():
    return list(Incident.objects(__raw__={"status": {"$in": OPEN_STATUSES}}).order_by(*SORT_ORDER).as_pymongo())


def find_open_for_service(service_id):
    conditions = {"serviceId": ObjectId(service_id), "status": {"$in": OPEN_STATUSES}}

    return list(Incident.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_open_for_service_since(service_id, since_moment):
    conditions = {"serviceId": ObjectId(service_id), "status": {"$in": OPEN_STATUSES}, "createdAt": {"$gte": since_moment}}

    return list(Incident.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_for_analytics(from_moment, to_moment):
    conditions = {"createdAt": {"$gte": from_moment, "$lt": to_moment}}

    return list(Incident.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def create(values):
    return Incident(**values).save().to_mongo()


def push_timeline(incident_id, entry, extra_set=None):
    moment = now_utc()

    return collection(Incident).find_one_and_update(
        {"_id": ObjectId(incident_id)},
        {"$push": {"timeline": entry}, "$set": {**(extra_set or {}), "updatedAt": moment}},
        return_document=ReturnDocument.AFTER,
    )


def advance_escalation_level(incident_id, expected_level, entry, extra_set):
    """Atomic compare-and-swap: only applies the escalation when currentLevel still matches what the
    caller last read. Two near-simultaneous reads of the same incident (concurrent requests, or React's
    development-mode double effect invocation) must not both push the same escalation twice."""
    moment = now_utc()

    return collection(Incident).find_one_and_update(
        {"_id": ObjectId(incident_id), "currentLevel": expected_level, "status": "triggered"},
        {"$push": {"timeline": entry}, "$set": {**extra_set, "updatedAt": moment}},
        return_document=ReturnDocument.AFTER,
    )


def set_fields(incident_id, values):
    incident = Incident.objects(id=ObjectId(incident_id)).first()

    if incident is None:
        return None

    for field, value in values.items():
        setattr(incident, field, value)

    incident.save()

    return incident.to_mongo()


def add_event_id(incident_id, event_id):
    return collection(Incident).find_one_and_update(
        {"_id": ObjectId(incident_id)},
        {"$addToSet": {"eventIds": event_id}, "$set": {"updatedAt": now_utc()}},
        return_document=ReturnDocument.AFTER,
    )
