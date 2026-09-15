import random

import bcrypt

from apps.shared.errors import AppError

from . import repository
from .constants import AVATAR_PALETTE

RESPONDER_NOT_FOUND_MESSAGE = "This responder no longer exists."
EMAIL_IN_USE_MESSAGE = "An account with this email already exists."


def public_responder(responder):
    if responder is None:
        return None

    return {
        "_id": responder["_id"],
        "name": responder["name"],
        "email": responder["email"],
        "role": responder["role"],
        "title": responder.get("title", ""),
        "phone": responder.get("phone", ""),
        "avatarColor": responder.get("avatarColor", "#5f6368"),
        "active": responder.get("active", True),
        "createdAt": responder.get("createdAt"),
    }


def list_responders(active_only=True):
    return [public_responder(responder) for responder in repository.find_all(active_only)]


def get_by_id(responder_id):
    responder = repository.find_by_id(responder_id)

    if responder is None:
        raise AppError(404, "RESPONDER_NOT_FOUND", RESPONDER_NOT_FOUND_MESSAGE)

    return public_responder(responder)


def find_existing(ids):
    return [public_responder(responder) for responder in repository.find_existing(ids)]


def hash_password(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_responder(values):
    if repository.find_by_email(values["email"]) is not None:
        raise AppError(409, "EMAIL_IN_USE", EMAIL_IN_USE_MESSAGE)

    created = repository.create(
        {
            "name": values["name"],
            "email": values["email"],
            "password_hash": hash_password(values["password"]),
            "role": values.get("role", "responder"),
            "title": values.get("title", ""),
            "phone": values.get("phone", ""),
            "avatar_color": random.choice(AVATAR_PALETTE),
        }
    )

    return public_responder(created)


def update_responder(responder_id, values):
    fields = {}

    if "name" in values:
        fields["name"] = values["name"]

    if "title" in values:
        fields["title"] = values["title"]

    if "phone" in values:
        fields["phone"] = values["phone"]

    if "role" in values:
        fields["role"] = values["role"]

    if "active" in values:
        fields["active"] = values["active"]

    updated = repository.update(responder_id, fields)

    if updated is None:
        raise AppError(404, "RESPONDER_NOT_FOUND", RESPONDER_NOT_FOUND_MESSAGE)

    return public_responder(updated)
