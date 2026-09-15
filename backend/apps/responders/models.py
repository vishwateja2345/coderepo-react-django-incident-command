from mongoengine import BooleanField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import DEFAULT_AVATAR_COLOR, MAX_EMAIL_LENGTH, MAX_NAME_LENGTH, MAX_PHONE_LENGTH, MAX_TITLE_LENGTH, ROLES


class Responder(TimestampedDocument):
    meta = {
        "collection": "responders",
        "indexes": [
            {"fields": ["email"], "unique": True, "name": "email_unique_idx"},
            {"fields": ["active"], "name": "active_idx"},
        ],
    }

    name = StringField(required=True, max_length=MAX_NAME_LENGTH)
    email = StringField(required=True, max_length=MAX_EMAIL_LENGTH)
    password_hash = StringField(db_field="passwordHash", required=True)
    role = StringField(choices=ROLES, default="responder", required=True)
    title = StringField(default="", max_length=MAX_TITLE_LENGTH)
    phone = StringField(default="", max_length=MAX_PHONE_LENGTH)
    avatar_color = StringField(db_field="avatarColor", default=DEFAULT_AVATAR_COLOR)
    active = BooleanField(default=True)
