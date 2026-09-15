import re

from apps.shared.validation import (
    Errors,
    read_date,
    read_identifier_list,
    read_number,
    read_option,
    read_string,
    read_time_zone,
)

from .constants import (
    HANDOFF_TIME_PATTERN,
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_REASON_LENGTH,
    MAX_RESPONDERS,
    MAX_SHIFT_HOURS,
    MIN_RESPONDERS,
    MIN_SHIFT_HOURS,
    ROTATION_TYPES,
)

HANDOFF_MESSAGE = "Enter a handoff time as HH:MM in 24-hour format."
TIME_ZONE_MESSAGE = "Choose a valid IANA time zone."
DUPLICATE_RESPONDER_MESSAGE = "Select each responder only once."
_HANDOFF_RE = re.compile(HANDOFF_TIME_PATTERN)


def read_handoff_time(errors, body, field, default=None):
    if field not in body and default is not None:
        return default

    value = read_string(errors, body, field)

    if value is None:
        return None

    if not _HANDOFF_RE.match(value):
        errors.add(field, HANDOFF_MESSAGE)
        return None

    return value


def validate_create(body):
    errors = Errors()
    values = {
        "name": read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
        "description": read_string(errors, body, "description", default="", trim=True, maximum=MAX_DESCRIPTION_LENGTH),
        "time_zone": read_time_zone(errors, body, "timeZone", TIME_ZONE_MESSAGE, default="UTC"),
        "responder_ids": read_identifier_list(
            errors, body, "responderIds", minimum=MIN_RESPONDERS, maximum=MAX_RESPONDERS, unique_message=DUPLICATE_RESPONDER_MESSAGE
        ),
        "rotation_type": read_option(errors, body, "rotationType", ROTATION_TYPES, default="weekly"),
        "shift_length_hours": read_number(errors, body, "shiftLengthHours", minimum=MIN_SHIFT_HOURS, maximum=MAX_SHIFT_HOURS),
        "handoff_time": read_handoff_time(errors, body, "handoffTime", default="09:00"),
        "rotation_start_at": read_date(errors, body, "rotationStartAt"),
    }

    errors.raise_if_any()

    return values


UPDATE_READERS = {
    "name": lambda errors, body: read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
    "description": lambda errors, body: read_string(errors, body, "description", trim=True, maximum=MAX_DESCRIPTION_LENGTH),
    "timeZone": lambda errors, body: read_time_zone(errors, body, "timeZone", TIME_ZONE_MESSAGE),
    "responderIds": lambda errors, body: read_identifier_list(
        errors, body, "responderIds", minimum=MIN_RESPONDERS, maximum=MAX_RESPONDERS, unique_message=DUPLICATE_RESPONDER_MESSAGE
    ),
    "rotationType": lambda errors, body: read_option(errors, body, "rotationType", ROTATION_TYPES),
    "shiftLengthHours": lambda errors, body: read_number(errors, body, "shiftLengthHours", minimum=MIN_SHIFT_HOURS, maximum=MAX_SHIFT_HOURS),
    "handoffTime": lambda errors, body: read_handoff_time(errors, body, "handoffTime"),
    "rotationStartAt": lambda errors, body: read_date(errors, body, "rotationStartAt"),
}
SNAKE_CASE_FIELD = {
    "name": "name",
    "description": "description",
    "timeZone": "time_zone",
    "responderIds": "responder_ids",
    "rotationType": "rotation_type",
    "shiftLengthHours": "shift_length_hours",
    "handoffTime": "handoff_time",
    "rotationStartAt": "rotation_start_at",
}


def validate_update(body):
    errors = Errors()
    values = {
        SNAKE_CASE_FIELD[field]: reader(errors, body) for field, reader in UPDATE_READERS.items() if field in body
    }

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values


def validate_override(body):
    errors = Errors()
    responder_id = read_string(errors, body, "responderId", minimum=1)
    start_at = read_date(errors, body, "startAt")
    end_at = read_date(errors, body, "endAt")
    reason = read_string(errors, body, "reason", default="", trim=True, maximum=MAX_REASON_LENGTH)

    if not errors.any() and start_at is not None and end_at is not None and start_at >= end_at:
        errors.add("endAt", "endAt must be after startAt")

    errors.raise_if_any()

    return {"responder_id": responder_id, "start_at": start_at, "end_at": end_at, "reason": reason}
