from apps.shared.validation import Errors, is_object_id, read_option, read_string

from .constants import MAX_DEDUP_KEY_LENGTH, MAX_SOURCE_LENGTH, MAX_SUMMARY_LENGTH, SEVERITIES, STATUSES


def validate_ingest(body):
    errors = Errors()
    values = {
        "summary": read_string(errors, body, "summary", trim=True, minimum=1, maximum=MAX_SUMMARY_LENGTH),
        "source": read_string(errors, body, "source", default="monitoring", trim=True, maximum=MAX_SOURCE_LENGTH),
        "severity": read_option(errors, body, "severity", SEVERITIES, default="critical"),
        "dedupKey": read_string(errors, body, "dedupKey", default=None, trim=True, maximum=MAX_DEDUP_KEY_LENGTH) if body.get("dedupKey") else None,
    }

    errors.raise_if_any()

    values["payload"] = body

    return values


def validate_filters(query_params):
    errors = Errors()
    service_id = query_params.get("serviceId")

    if service_id and not is_object_id(service_id):
        errors.add("serviceId", "Choose a valid option.")
        service_id = None

    values = {
        "service_id": service_id,
        "status": read_option(errors, query_params, "status", STATUSES, default=None) if query_params.get("status") else None,
    }

    errors.raise_if_any()

    return values
