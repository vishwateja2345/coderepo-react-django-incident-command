from mongoengine import DateTimeField, IntField, ListField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, MAX_REASON_LENGTH, ROTATION_TYPES


class Schedule(TimestampedDocument):
    meta = {"collection": "schedules"}

    name = StringField(required=True, max_length=MAX_NAME_LENGTH)
    description = StringField(default="", max_length=MAX_DESCRIPTION_LENGTH)
    time_zone = StringField(db_field="timeZone", default="UTC", max_length=100)
    responder_ids = ListField(ObjectIdField(), db_field="responderIds", default=list)
    rotation_type = StringField(db_field="rotationType", choices=ROTATION_TYPES, default="weekly")
    shift_length_hours = IntField(db_field="shiftLengthHours", default=168)
    handoff_time = StringField(db_field="handoffTime", default="09:00", max_length=5)
    rotation_start_at = DateTimeField(db_field="rotationStartAt", required=True)


class ScheduleOverride(TimestampedDocument):
    meta = {
        "collection": "schedule_overrides",
        "indexes": [{"fields": ["schedule_id", "start_at", "end_at"], "name": "schedule_range_idx"}],
    }

    schedule_id = ObjectIdField(db_field="scheduleId", required=True)
    responder_id = ObjectIdField(db_field="responderId", required=True)
    start_at = DateTimeField(db_field="startAt", required=True)
    end_at = DateTimeField(db_field="endAt", required=True)
    reason = StringField(default="", max_length=MAX_REASON_LENGTH)
