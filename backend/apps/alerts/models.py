from mongoengine import DateTimeField, DictField, IntField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_DEDUP_KEY_LENGTH, MAX_SOURCE_LENGTH, MAX_SUMMARY_LENGTH, SEVERITIES, STATUSES


class AlertEvent(TimestampedDocument):
    meta = {
        "collection": "alert_events",
        "indexes": [
            {"fields": ["service_id", "dedup_key"], "name": "service_dedup_idx"},
            {"fields": ["incident_id"], "name": "incident_idx"},
        ],
    }

    service_id = ObjectIdField(db_field="serviceId", required=True)
    incident_id = ObjectIdField(db_field="incidentId", null=True, default=None)
    source = StringField(default="monitoring", max_length=MAX_SOURCE_LENGTH)
    summary = StringField(required=True, max_length=MAX_SUMMARY_LENGTH)
    severity = StringField(choices=SEVERITIES, default="critical")
    dedup_key = StringField(db_field="dedupKey", required=True, max_length=MAX_DEDUP_KEY_LENGTH)
    status = StringField(choices=STATUSES, default="open")
    occurrence_count = IntField(db_field="occurrenceCount", default=1)
    payload = DictField(default=dict)
    received_at = DateTimeField(db_field="receivedAt", required=True)
