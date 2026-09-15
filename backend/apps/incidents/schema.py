from apps.shared.validation import Errors, is_object_id, read_boolean, read_option, read_string

from .constants import MAX_DESCRIPTION_LENGTH, MAX_MESSAGE_LENGTH, MAX_TITLE_LENGTH, STATUSES, URGENCIES

INVALID_ID_MESSAGE = "Choose a valid option."


def read_object_id(errors, body, field, required=True):
    if not required and field not in body:
        return None

    value = read_string(errors, body, field, minimum=1)

    if value is not None and not is_object_id(value):
        errors.add(field, INVALID_ID_MESSAGE)
        return None

    return value


def validate_create(body):
    errors = Errors()
    values = {
        "service_id": read_object_id(errors, body, "serviceId"),
        "title": read_string(errors, body, "title", trim=True, minimum=1, maximum=MAX_TITLE_LENGTH),
        "description": read_string(errors, body, "description", default="", trim=True, maximum=MAX_DESCRIPTION_LENGTH),
        "urgency": read_option(errors, body, "urgency", URGENCIES, default=None),
    }

    errors.raise_if_any()

    return values


def validate_update(body):
    errors = Errors()
    values = {}

    if "title" in body:
        values["title"] = read_string(errors, body, "title", trim=True, minimum=1, maximum=MAX_TITLE_LENGTH)

    if "description" in body:
        values["description"] = read_string(errors, body, "description", trim=True, maximum=MAX_DESCRIPTION_LENGTH)

    if "urgency" in body:
        values["urgency"] = read_option(errors, body, "urgency", URGENCIES)

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values


def validate_assign(body):
    errors = Errors()
    responder_id = read_object_id(errors, body, "responderId")

    errors.raise_if_any()

    return responder_id


def validate_note(body):
    errors = Errors()
    values = {
        "message": read_string(errors, body, "message", trim=True, minimum=1, maximum=MAX_MESSAGE_LENGTH),
        "customer_facing": read_boolean(errors, body, "customerFacing", default=False),
    }

    errors.raise_if_any()

    return values


def validate_filters(query_params):
    errors = Errors()
    values = {
        "service_id": read_object_id(errors, query_params, "serviceId", required=False),
        "status": read_option(errors, query_params, "status", STATUSES, default=None) if query_params.get("status") else None,
        "assignee_id": read_object_id(errors, query_params, "assigneeId", required=False),
    }

    errors.raise_if_any()

    return values
