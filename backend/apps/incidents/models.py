from mongoengine import DateTimeField, EmbeddedDocument, EmbeddedDocumentListField, IntField, ListField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_ACTOR_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_MESSAGE_LENGTH, MAX_TITLE_LENGTH, STATUSES, TIMELINE_TYPES, URGENCIES


class TimelineEntry(EmbeddedDocument):
    type = StringField(choices=TIMELINE_TYPES, required=True)
    message = StringField(required=True, max_length=MAX_MESSAGE_LENGTH)
    actor_id = ObjectIdField(db_field="actorId", null=True, default=None)
    actor_name = StringField(db_field="actorName", default="System", max_length=MAX_ACTOR_NAME_LENGTH)
    at = DateTimeField(required=True)


class Incident(TimestampedDocument):
    meta = {
        "collection": "incidents",
        "indexes": [
            {"fields": ["service_id", "status"], "name": "service_status_idx"},
            {"fields": ["status"], "name": "status_idx"},
            {"fields": ["assignee_id"], "name": "assignee_idx"},
        ],
    }

    service_id = ObjectIdField(db_field="serviceId", required=True)
    title = StringField(required=True, max_length=MAX_TITLE_LENGTH)
    description = StringField(default="", max_length=MAX_DESCRIPTION_LENGTH)
    status = StringField(choices=STATUSES, default="triggered", required=True)
    urgency = StringField(choices=URGENCIES, default="high", required=True)
    assignee_id = ObjectIdField(db_field="assigneeId", null=True, default=None)
    escalation_policy_id = ObjectIdField(db_field="escalationPolicyId", null=True, default=None)
    current_level = IntField(db_field="currentLevel", default=0)
    event_ids = ListField(ObjectIdField(), db_field="eventIds", default=list)
    timeline = EmbeddedDocumentListField(TimelineEntry, default=list)
    acknowledged_at = DateTimeField(db_field="acknowledgedAt", null=True, default=None)
    resolved_at = DateTimeField(db_field="resolvedAt", null=True, default=None)
    last_escalated_at = DateTimeField(db_field="lastEscalatedAt", null=True, default=None)
