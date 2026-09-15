from mongoengine import EmbeddedDocument, EmbeddedDocumentListField, IntField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, MAX_TIMEOUT_MINUTES, MIN_TIMEOUT_MINUTES, TARGET_TYPES


class EscalationLevel(EmbeddedDocument):
    order = IntField(required=True, min_value=1)
    target_type = StringField(db_field="targetType", choices=TARGET_TYPES, required=True)
    target_id = ObjectIdField(db_field="targetId", required=True)
    timeout_minutes = IntField(db_field="timeoutMinutes", required=True, min_value=MIN_TIMEOUT_MINUTES, max_value=MAX_TIMEOUT_MINUTES)


class EscalationPolicy(TimestampedDocument):
    meta = {"collection": "escalation_policies"}

    name = StringField(required=True, max_length=MAX_NAME_LENGTH)
    description = StringField(default="", max_length=MAX_DESCRIPTION_LENGTH)
    levels = EmbeddedDocumentListField(EscalationLevel, default=list)
