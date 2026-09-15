from bson import ObjectId

from .models import EscalationPolicy

SORT_ORDER = ["name"]


def find_all():
    return list(EscalationPolicy.objects(__raw__={}).order_by(*SORT_ORDER).as_pymongo())


def find_by_id(policy_id):
    return EscalationPolicy.objects(__raw__={"_id": ObjectId(policy_id)}).as_pymongo().first()


def create(values):
    return EscalationPolicy(**values).save().to_mongo()


def update(policy_id, values):
    policy = EscalationPolicy.objects(id=ObjectId(policy_id)).first()

    if policy is None:
        return None

    for field, value in values.items():
        setattr(policy, field, value)

    policy.save()

    return policy.to_mongo()


def delete(policy_id):
    policy = EscalationPolicy.objects(id=ObjectId(policy_id)).first()

    if policy is None:
        return False

    policy.delete()

    return True
