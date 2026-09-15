from apps.responders.constants import MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH
from apps.shared.errors import ValidationError
from apps.shared.validation import Errors, read_email, read_string


def validate_login(body):
    errors = Errors()
    email = read_email(errors, body, "email", MAX_EMAIL_LENGTH)
    password = read_string(errors, body, "password", minimum=1, maximum=MAX_PASSWORD_LENGTH)

    if errors.any():
        raise ValidationError(errors.form_errors, errors.field_errors)

    return email, password
