from apps.shared.validation import Errors, expected_message, is_object_id, js_type_name, read_number, read_option, read_string, too_big_message, too_small_message

from .constants import MAX_DESCRIPTION_LENGTH, MAX_LEVELS, MAX_NAME_LENGTH, MAX_TIMEOUT_MINUTES, MIN_TIMEOUT_MINUTES, TARGET_TYPES

INVALID_TARGET_MESSAGE = "Choose a valid responder or schedule for this level."


def validate_levels(errors, body, required):
    if "levels" not in body:
        if required:
            errors.add("levels", expected_message("array", "undefined"))

        return None

    value = body.get("levels")

    if not isinstance(value, list):
        errors.add("levels", expected_message("array", js_type_name(value)))
        return None

    if len(value) < 1:
        errors.add("levels", too_small_message("array", 1, "items"))
        return None

    if len(value) > MAX_LEVELS:
        errors.add("levels", too_big_message("array", MAX_LEVELS, "items"))
        return None

    levels = []

    for index, item in enumerate(value):
        if not isinstance(item, dict):
            errors.add(f"levels[{index}]", expected_message("object", js_type_name(item)))
            continue

        level_errors = Errors()
        target_type = read_option(level_errors, item, "targetType", TARGET_TYPES)
        target_id = read_string(level_errors, item, "targetId", minimum=1)
        timeout_minutes = read_number(level_errors, item, "timeoutMinutes", minimum=MIN_TIMEOUT_MINUTES, maximum=MAX_TIMEOUT_MINUTES)

        if target_id is not None and not is_object_id(target_id):
            level_errors.add("targetId", INVALID_TARGET_MESSAGE)
            target_id = None

        for field, messages in level_errors.field_errors.items():
            for message in messages:
                errors.add(f"levels[{index}].{field}", message)

        if target_type is None or target_id is None or timeout_minutes is None:
            continue

        levels.append({"order": index + 1, "target_type": target_type, "target_id": target_id, "timeout_minutes": timeout_minutes})

    return levels


def validate_create(body):
    errors = Errors()
    values = {
        "name": read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
        "description": read_string(errors, body, "description", default="", trim=True, maximum=MAX_DESCRIPTION_LENGTH),
        "levels": validate_levels(errors, body, required=True),
    }

    errors.raise_if_any()

    return values


def validate_update(body):
    errors = Errors()
    values = {}

    if "name" in body:
        values["name"] = read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH)

    if "description" in body:
        values["description"] = read_string(errors, body, "description", trim=True, maximum=MAX_DESCRIPTION_LENGTH)

    if "levels" in body:
        values["levels"] = validate_levels(errors, body, required=True)

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values
