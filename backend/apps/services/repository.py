from bson import ObjectId

from .models import Service

SORT_ORDER = ["name"]


def find_all(active_only=False):
    conditions = {"active": True} if active_only else {}

    return list(Service.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_by_id(service_id):
    if not ObjectId.is_valid(service_id):
        return None

    return Service.objects(__raw__={"_id": ObjectId(service_id)}).as_pymongo().first()


def find_by_integration_key(key):
    return Service.objects(__raw__={"integrationKey": key, "active": True}).as_pymongo().first()


def find_existing(ids):
    identifiers = [ObjectId(value) for value in dict.fromkeys(str(value) for value in ids)]

    return list(Service.objects(__raw__={"_id": {"$in": identifiers}}).as_pymongo())


def create(values):
    return Service(**values).save().to_mongo()


def update(service_id, values):
    service = Service.objects(id=ObjectId(service_id)).first()

    if service is None:
        return None

    for field, value in values.items():
        setattr(service, field, value)

    service.save()

    return service.to_mongo()


def delete(service_id):
    service = Service.objects(id=ObjectId(service_id)).first()

    if service is None:
        return False

    service.delete()

    return True
