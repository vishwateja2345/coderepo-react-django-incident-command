from mongoengine import BooleanField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, URGENCIES


class Service(TimestampedDocument):
    meta = {
        "collection": "services",
        "indexes": [{"fields": ["integration_key"], "unique": True, "name": "integration_key_unique_idx"}],
    }

    name = StringField(required=True, max_length=MAX_NAME_LENGTH)
    description = StringField(default="", max_length=MAX_DESCRIPTION_LENGTH)
    owner_id = ObjectIdField(db_field="ownerId", required=True)
    integration_key = StringField(db_field="integrationKey", required=True, max_length=40)
    escalation_policy_id = ObjectIdField(db_field="escalationPolicyId", null=True, default=None)
    workflow_template_id = ObjectIdField(db_field="workflowTemplateId", null=True, default=None)
    default_urgency = StringField(db_field="defaultUrgency", choices=URGENCIES, default="high")
    active = BooleanField(default=True)
