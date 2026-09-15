from bson import ObjectId
from pymongo import ReturnDocument

from apps.shared.documents import now_utc
from apps.shared.mongo import collection

from .models import AlertEvent

SORT_ORDER = ["-received_at"]


def find_all(filters):
    conditions = {}

    if filters.get("service_id"):
        conditions["serviceId"] = ObjectId(filters["service_id"])

    if filters.get("status"):
        conditions["status"] = filters["status"]

    return list(AlertEvent.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_by_id(event_id):
    if not ObjectId.is_valid(event_id):
        return None

    return AlertEvent.objects(__raw__={"_id": ObjectId(event_id)}).as_pymongo().first()


def find_recent_duplicate(service_id, dedup_key, since_moment):
    conditions = {
        "serviceId": ObjectId(service_id),
        "dedupKey": dedup_key,
        "receivedAt": {"$gte": since_moment},
    }

    return AlertEvent.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo().first()


def create(values):
    return AlertEvent(**values).save().to_mongo()


def increment_occurrence(event_id):
    return collection(AlertEvent).find_one_and_update(
        {"_id": ObjectId(event_id)},
        {"$inc": {"occurrenceCount": 1}, "$set": {"receivedAt": now_utc(), "updatedAt": now_utc()}},
        return_document=ReturnDocument.AFTER,
    )


def attach_to_incident(event_id, incident_id):
    return collection(AlertEvent).find_one_and_update(
        {"_id": ObjectId(event_id)},
        {"$set": {"incidentId": incident_id, "status": "triaged", "updatedAt": now_utc()}},
        return_document=ReturnDocument.AFTER,
    )
