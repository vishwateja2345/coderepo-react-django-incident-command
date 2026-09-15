from apps.shared.validation import Errors, expected_message, is_object_id, js_type_name, read_option, read_string

from .constants import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, URGENCIES

INVALID_ID_MESSAGE = "Choose a valid option."


def read_optional_object_id(errors, body, field):
    if field not in body:
        return None

    value = body.get(field)

    if value is None:
        return None

    if not isinstance(value, str):
        errors.add(field, expected_message("string", js_type_name(value)))
        return None

    if not is_object_id(value):
        errors.add(field, INVALID_ID_MESSAGE)
        return None

    return value


def validate_create(body):
    errors = Errors()
    owner_id = read_string(errors, body, "ownerId", minimum=1)

    if owner_id is not None and not is_object_id(owner_id):
        errors.add("ownerId", INVALID_ID_MESSAGE)
        owner_id = None

    values = {
        "name": read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
        "description": read_string(errors, body, "description", default="", trim=True, maximum=MAX_DESCRIPTION_LENGTH),
        "owner_id": owner_id,
        "escalation_policy_id": read_optional_object_id(errors, body, "escalationPolicyId"),
        "workflow_template_id": read_optional_object_id(errors, body, "workflowTemplateId"),
        "default_urgency": read_option(errors, body, "defaultUrgency", URGENCIES, default="high"),
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

    if "ownerId" in body:
        owner_id = read_string(errors, body, "ownerId", minimum=1)

        if owner_id is not None and not is_object_id(owner_id):
            errors.add("ownerId", INVALID_ID_MESSAGE)
            owner_id = None

        values["owner_id"] = owner_id

    if "escalationPolicyId" in body:
        values["escalation_policy_id"] = read_optional_object_id(errors, body, "escalationPolicyId")

    if "workflowTemplateId" in body:
        values["workflow_template_id"] = read_optional_object_id(errors, body, "workflowTemplateId")

    if "defaultUrgency" in body:
        values["default_urgency"] = read_option(errors, body, "defaultUrgency", URGENCIES)

    if "active" in body:
        value = body.get("active")

        if not isinstance(value, bool):
            errors.add("active", expected_message("boolean", js_type_name(value)))
        else:
            values["active"] = value

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values
