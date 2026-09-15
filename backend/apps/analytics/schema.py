from apps.shared.validation import Errors, read_date


def validate_range(query_params):
    errors = Errors()
    values = {
        "from": read_date(errors, query_params, "from", default=None),
        "to": read_date(errors, query_params, "to", default=None),
    }

    errors.raise_if_any()

    return values
