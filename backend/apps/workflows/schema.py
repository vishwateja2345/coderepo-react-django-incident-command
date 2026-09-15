from apps.shared.validation import (
    OBJECT_ID_PATTERN,
    Errors,
    expected_message,
    is_object_id,
    js_type_name,
    read_boolean,
    read_string,
    too_big_message,
    too_small_message,
)

from .constants import MAX_NAME_LENGTH, MAX_STEP_DESCRIPTION_LENGTH, MAX_STEPS, MAX_STEP_TITLE_LENGTH


def read_service_id(errors, body, field, default=None):
    if field not in body:
        return default

    value = body.get(field)

    if value is None:
        return None

    if not isinstance(value, str):
        errors.add(field, expected_message("string", js_type_name(value)))
        return None

    if not is_object_id(value):
        errors.add(field, f"Invalid string: must match pattern {OBJECT_ID_PATTERN.pattern}")
        return None

    return value


def validate_steps(errors, body, required):
    if "steps" not in body:
        if required:
            errors.add("steps", expected_message("array", "undefined"))

        return None

    value = body.get("steps")

    if not isinstance(value, list):
        errors.add("steps", expected_message("array", js_type_name(value)))
        return None

    if len(value) < 1:
        errors.add("steps", too_small_message("array", 1, "items"))
        return None

    if len(value) > MAX_STEPS:
        errors.add("steps", too_big_message("array", MAX_STEPS, "items"))
        return None

    steps = []

    for index, item in enumerate(value):
        if not isinstance(item, dict):
            errors.add(f"steps[{index}]", expected_message("object", js_type_name(item)))
            continue

        step_errors = Errors()
        title = read_string(
            step_errors,
            item,
            "title",
            trim=True,
            minimum=1,
            maximum=MAX_STEP_TITLE_LENGTH,
        )
        description = read_string(
            step_errors,
            item,
            "description",
            default="",
            trim=True,
            maximum=MAX_STEP_DESCRIPTION_LENGTH,
        )

        for field, messages in step_errors.field_errors.items():
            for message in messages:
                errors.add(f"steps[{index}].{field}", message)

        for message in step_errors.form_errors:
            errors.add(f"steps[{index}]", message)

        if title is None or description is None:
            continue

        steps.append(
            {
                "order": index + 1,
                "title": title,
                "description": description,
            }
        )

    return steps


def validate_template_filters(query_params):
    errors = Errors()
    service_id = query_params.get("serviceId")

    if service_id in (None, ""):
        values = {"service_id": None}
    elif not is_object_id(service_id):
        errors.add("serviceId", f"Invalid string: must match pattern {OBJECT_ID_PATTERN.pattern}")
        values = {"service_id": None}
    else:
        values = {"service_id": service_id}

    errors.raise_if_any()

    return values


def validate_create_template(body):
    errors = Errors()
    values = {
        "name": read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
        "service_id": read_service_id(errors, body, "serviceId", default=None),
        "steps": validate_steps(errors, body, required=True),
    }

    errors.raise_if_any()

    return values


UPDATE_READERS = {
    "name": lambda errors, body: read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
    "serviceId": lambda errors, body: read_service_id(errors, body, "serviceId"),
    "steps": lambda errors, body: validate_steps(errors, body, required=False),
}


def validate_update_template(body):
    errors = Errors()
    values = {}

    for field, reader in UPDATE_READERS.items():
        if field not in body:
            continue

        value = reader(errors, body)

        if field == "serviceId":
            values["service_id"] = value
        else:
            values[field] = value

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values


def validate_toggle_step(body):
    errors = Errors()
    values = {"done": read_boolean(errors, body, "done")}

    errors.raise_if_any()

    return values
