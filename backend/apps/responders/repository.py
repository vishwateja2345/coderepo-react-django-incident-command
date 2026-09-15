from bson import ObjectId

from .models import Responder

SORT_ORDER = ["name"]


def find_all(active_only=False):
    conditions = {"active": True} if active_only else {}

    return list(Responder.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_by_id(responder_id):
    return Responder.objects(__raw__={"_id": ObjectId(responder_id)}).as_pymongo().first()


def find_active_by_id(responder_id):
    return Responder.objects(__raw__={"_id": ObjectId(responder_id), "active": True}).as_pymongo().first()


def find_by_email(email):
    return Responder.objects(__raw__={"email": email}).as_pymongo().first()


def find_active_by_email(email):
    return Responder.objects(__raw__={"email": email, "active": True}).as_pymongo().first()


def find_existing(ids):
    identifiers = [ObjectId(value) for value in dict.fromkeys(str(value) for value in ids)]

    return list(Responder.objects(__raw__={"_id": {"$in": identifiers}}).as_pymongo())


def create(values):
    return Responder(**values).save().to_mongo()


def update(responder_id, values):
    responder = Responder.objects(id=ObjectId(responder_id)).first()

    if responder is None:
        return None

    for field, value in values.items():
        setattr(responder, field, value)

    responder.save()

    return responder.to_mongo()
