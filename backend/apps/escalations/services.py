from apps.oncall import repository as oncall_repository
from apps.oncall import services as oncall_service
from apps.responders import repository as responder_repository
from apps.shared.errors import AppError
from apps.shared.validation import is_object_id

from . import repository

POLICY_NOT_FOUND_MESSAGE = "This escalation policy no longer exists."


def target_name(target_type, target_id):
    if target_type == "responder":
        responder = responder_repository.find_by_id(str(target_id))

        return responder["name"] if responder else "Former responder"

    schedule = oncall_repository.find_by_id(str(target_id))

    return schedule["name"] if schedule else "Former schedule"


def decorate_level(level):
    return {**level, "targetName": target_name(level["targetType"], level["targetId"])}


def public_policy(policy):
    return {
        "_id": policy["_id"],
        "name": policy["name"],
        "description": policy.get("description", ""),
        "levels": [decorate_level(level) for level in sorted(policy.get("levels", []), key=lambda level: level["order"])],
        "createdAt": policy.get("createdAt"),
    }


def list_policies():
    return [public_policy(policy) for policy in repository.find_all()]


def load(policy_id):
    if not is_object_id(policy_id):
        raise AppError(404, "POLICY_NOT_FOUND", POLICY_NOT_FOUND_MESSAGE)

    policy = repository.find_by_id(policy_id)

    if policy is None:
        raise AppError(404, "POLICY_NOT_FOUND", POLICY_NOT_FOUND_MESSAGE)

    return policy


def get_by_id(policy_id):
    return public_policy(load(policy_id))


def create_policy(values):
    return public_policy(repository.create(values))


def update_policy(policy_id, values):
    load(policy_id)

    return public_policy(repository.update(policy_id, values))


def delete_policy(policy_id):
    load(policy_id)
    repository.delete(policy_id)


def get_level(policy, order):
    return next((level for level in policy.get("levels", []) if level["order"] == order), None)


def resolve_target_responder_id(policy, level_order, at_moment=None):
    level = get_level(policy, level_order)

    if level is None:
        return None

    if level["targetType"] == "responder":
        return level["targetId"]

    schedule = oncall_repository.find_by_id(str(level["targetId"]))

    if schedule is None:
        return None

    return oncall_service.compute_current_responder_id(schedule, at_moment)


def level_count(policy):
    return len(policy.get("levels", []))
