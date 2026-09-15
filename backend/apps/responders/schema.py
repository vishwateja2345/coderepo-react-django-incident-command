from apps.shared.validation import Errors, read_boolean, read_email, read_option, read_string

from .constants import MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, MAX_PASSWORD_LENGTH, MAX_PHONE_LENGTH, MAX_TITLE_LENGTH, MIN_PASSWORD_LENGTH, ROLES


def validate_create(body):
    errors = Errors()
    values = {
        "name": read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
        "email": read_email(errors, body, "email", MAX_EMAIL_LENGTH),
        "password": read_string(errors, body, "password", minimum=MIN_PASSWORD_LENGTH, maximum=MAX_PASSWORD_LENGTH),
        "role": read_option(errors, body, "role", ROLES, default="responder"),
        "title": read_string(errors, body, "title", default="", trim=True, maximum=MAX_TITLE_LENGTH),
        "phone": read_string(errors, body, "phone", default="", trim=True, maximum=MAX_PHONE_LENGTH),
    }

    errors.raise_if_any()

    return values


UPDATE_READERS = {
    "name": lambda errors, body: read_string(errors, body, "name", trim=True, minimum=1, maximum=MAX_NAME_LENGTH),
    "title": lambda errors, body: read_string(errors, body, "title", trim=True, maximum=MAX_TITLE_LENGTH),
    "phone": lambda errors, body: read_string(errors, body, "phone", trim=True, maximum=MAX_PHONE_LENGTH),
    "role": lambda errors, body: read_option(errors, body, "role", ROLES),
    "active": lambda errors, body: read_boolean(errors, body, "active"),
}


def validate_update(body):
    errors = Errors()
    values = {field: reader(errors, body) for field, reader in UPDATE_READERS.items() if field in body}

    if not errors.any() and not values:
        errors.add_form("Provide at least one field to update.")

    errors.raise_if_any()

    return values
