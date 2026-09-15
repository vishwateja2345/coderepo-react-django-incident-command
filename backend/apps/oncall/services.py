import math
from datetime import timedelta

from bson import ObjectId

from apps.responders import repository as responder_repository
from apps.shared.documents import now_utc
from apps.shared.errors import AppError

from . import repository
from .constants import UPCOMING_SHIFT_COUNT

SCHEDULE_NOT_FOUND_MESSAGE = "This on-call schedule no longer exists."
OVERRIDE_NOT_FOUND_MESSAGE = "This override no longer exists."


def responder_name(responder_id):
    if responder_id is None:
        return None

    responder = responder_repository.find_by_id(str(responder_id))

    return responder["name"] if responder else "Former responder"


def public_schedule(schedule):
    return {
        "_id": schedule["_id"],
        "name": schedule["name"],
        "description": schedule.get("description", ""),
        "timeZone": schedule.get("timeZone", "UTC"),
        "responderIds": schedule.get("responderIds", []),
        "rotationType": schedule.get("rotationType", "weekly"),
        "shiftLengthHours": schedule.get("shiftLengthHours", 168),
        "handoffTime": schedule.get("handoffTime", "09:00"),
        "rotationStartAt": schedule["rotationStartAt"],
        "createdAt": schedule.get("createdAt"),
    }


def decorate_schedule(schedule):
    at_moment = now_utc()
    current_id = compute_current_responder_id(schedule, at_moment)

    return {
        **public_schedule(schedule),
        "responders": [
            {"_id": responder_id, "name": responder_name(responder_id)} for responder_id in schedule.get("responderIds", [])
        ],
        "currentResponderId": current_id,
        "currentResponderName": responder_name(current_id),
    }


def list_schedules():
    return [decorate_schedule(schedule) for schedule in repository.find_all()]


def load(schedule_id):
    if not ObjectId.is_valid(schedule_id):
        raise AppError(404, "SCHEDULE_NOT_FOUND", SCHEDULE_NOT_FOUND_MESSAGE)

    schedule = repository.find_by_id(schedule_id)

    if schedule is None:
        raise AppError(404, "SCHEDULE_NOT_FOUND", SCHEDULE_NOT_FOUND_MESSAGE)

    return schedule


def get_by_id(schedule_id):
    return decorate_schedule(load(schedule_id))


def create_schedule(values):
    created = repository.create(values)

    return decorate_schedule(created)


def update_schedule(schedule_id, values):
    load(schedule_id)
    updated = repository.update(schedule_id, values)

    return decorate_schedule(updated)


def delete_schedule(schedule_id):
    load(schedule_id)
    repository.delete(schedule_id)


def rotation_responder_id(schedule, at_moment):
    responder_ids = schedule.get("responderIds") or []

    if not responder_ids:
        return None

    shift_seconds = max(1, schedule.get("shiftLengthHours", 168)) * 3600
    elapsed_seconds = (at_moment - schedule["rotationStartAt"]).total_seconds()
    shift_index = math.floor(elapsed_seconds / shift_seconds)
    responder_index = shift_index % len(responder_ids)

    return responder_ids[responder_index]


def compute_current_responder_id(schedule, at_moment=None):
    at_moment = at_moment or now_utc()
    override = repository.find_active_override(str(schedule["_id"]), at_moment)

    if override:
        return override["responderId"]

    return rotation_responder_id(schedule, at_moment)


def current_shift_window(schedule, at_moment):
    shift_seconds = max(1, schedule.get("shiftLengthHours", 168)) * 3600
    elapsed_seconds = (at_moment - schedule["rotationStartAt"]).total_seconds()
    shift_index = math.floor(elapsed_seconds / shift_seconds)
    start = schedule["rotationStartAt"] + timedelta(seconds=shift_index * shift_seconds)

    return start, start + timedelta(seconds=shift_seconds)


def upcoming_shifts(schedule_id):
    schedule = load(schedule_id)
    responder_ids = schedule.get("responderIds") or []

    if not responder_ids:
        return []

    at_moment = now_utc()
    start, _ = current_shift_window(schedule, at_moment)
    shift_length = timedelta(hours=max(1, schedule.get("shiftLengthHours", 168)))
    overrides = repository.find_overrides_in_range(schedule_id, start, start + shift_length * UPCOMING_SHIFT_COUNT)
    shifts = []

    for index in range(UPCOMING_SHIFT_COUNT):
        shift_start = start + shift_length * index
        shift_end = shift_start + shift_length
        override = next((item for item in overrides if item["startAt"] <= shift_start < item["endAt"]), None)
        responder_id = override["responderId"] if override else responder_ids[index % len(responder_ids)]
        shifts.append(
            {
                "startAt": shift_start,
                "endAt": shift_end,
                "responderId": responder_id,
                "responderName": responder_name(responder_id),
                "isOverride": override is not None,
            }
        )

    return shifts


def public_override(override):
    return {
        "_id": override["_id"],
        "scheduleId": override["scheduleId"],
        "responderId": override["responderId"],
        "responderName": responder_name(override["responderId"]),
        "startAt": override["startAt"],
        "endAt": override["endAt"],
        "reason": override.get("reason", ""),
    }


def list_overrides(schedule_id):
    load(schedule_id)

    return [public_override(override) for override in repository.find_overrides(schedule_id)]


def add_override(schedule_id, values):
    load(schedule_id)
    created = repository.create_override({**values, "schedule_id": ObjectId(schedule_id)})

    return public_override(created)


def remove_override(schedule_id, override_id):
    load(schedule_id)
    override = repository.find_override_by_id(override_id)

    if override is None or str(override["scheduleId"]) != schedule_id:
        raise AppError(404, "OVERRIDE_NOT_FOUND", OVERRIDE_NOT_FOUND_MESSAGE)

    repository.delete_override(override_id)
