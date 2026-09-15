from bson import ObjectId

from apps.services import repository as service_repository
from apps.shared.errors import AppError
from apps.shared.validation import is_object_id

from . import repository

TEMPLATE_NOT_FOUND_MESSAGE = "This workflow template no longer exists."
INSTANCE_NOT_FOUND_MESSAGE = "This workflow instance no longer exists."
STEP_NOT_FOUND_MESSAGE = "This workflow step no longer exists."
SERVICE_NOT_FOUND_MESSAGE = "This service no longer exists."


def get_template_or_error(template_id):
    if not is_object_id(template_id):
        raise AppError(404, "TEMPLATE_NOT_FOUND", TEMPLATE_NOT_FOUND_MESSAGE)

    template = repository.find_template_by_id(template_id)

    if template is None:
        raise AppError(404, "TEMPLATE_NOT_FOUND", TEMPLATE_NOT_FOUND_MESSAGE)

    return template


def validate_service(service_id):
    if service_id is None:
        return

    if service_repository.find_by_id(service_id) is None:
        raise AppError(404, "SERVICE_NOT_FOUND", SERVICE_NOT_FOUND_MESSAGE)


def get_instance_or_error(instance_id):
    if not is_object_id(instance_id):
        raise AppError(404, "WORKFLOW_INSTANCE_NOT_FOUND", INSTANCE_NOT_FOUND_MESSAGE)

    instance = repository.find_instance_by_id(instance_id)

    if instance is None:
        raise AppError(404, "WORKFLOW_INSTANCE_NOT_FOUND", INSTANCE_NOT_FOUND_MESSAGE)

    return instance


def list_templates(service_id=None):
    return repository.find_templates(service_id)


def get_template(template_id):
    return get_template_or_error(template_id)


def create_template(values):
    validate_service(values.get("service_id"))

    return repository.create_template(values)


def update_template(template_id, values):
    get_template_or_error(template_id)

    if "service_id" in values:
        validate_service(values["service_id"])

    updated = repository.update_template(template_id, values)

    if updated is None:
        raise AppError(404, "TEMPLATE_NOT_FOUND", TEMPLATE_NOT_FOUND_MESSAGE)

    return updated


def delete_template(template_id):
    get_template_or_error(template_id)

    repository.delete_template(template_id)


def instantiate_for_incident(template_id, incident_id):
    template = get_template_or_error(template_id)
    steps = [
        {
            "order": step["order"],
            "title": step["title"],
            "description": step.get("description", ""),
            "done": False,
            "done_at": None,
            "done_by_name": "",
        }
        for step in template.get("steps", [])
    ]

    return repository.create_instance(
        {
            "incident_id": ObjectId(incident_id),
            "template_id": template["_id"],
            "template_name": template["name"],
            "steps": steps,
        }
    )


def get_for_incident(incident_id):
    if not is_object_id(incident_id):
        return None

    return repository.find_instance_by_incident(incident_id)


def toggle_step(instance_id, order, done, actor):
    instance = get_instance_or_error(instance_id)
    step = next((item for item in instance.get("steps", []) if item.get("order") == order), None)

    if step is None:
        raise AppError(404, "WORKFLOW_STEP_NOT_FOUND", STEP_NOT_FOUND_MESSAGE)

    updated = repository.update_step(instance_id, order, done, actor["name"])

    if updated is None:
        raise AppError(404, "WORKFLOW_STEP_NOT_FOUND", STEP_NOT_FOUND_MESSAGE)

    from apps.incidents import services as incident_service

    incident_service.append_timeline(
        str(instance["incidentId"]),
        "note",
        f'Workflow step "{step["title"]}" marked {"done" if done else "not done"} by {actor["name"]}.',
        actor,
    )

    return updated
