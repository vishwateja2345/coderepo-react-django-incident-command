from mongoengine import BooleanField, DateTimeField, EmbeddedDocument, EmbeddedDocumentListField, IntField, ObjectIdField, StringField

from apps.shared.documents import TimestampedDocument

from .constants import MAX_ACTOR_NAME_LENGTH, MAX_NAME_LENGTH, MAX_STEP_DESCRIPTION_LENGTH, MAX_STEP_TITLE_LENGTH


class TemplateStep(EmbeddedDocument):
    order = IntField(required=True, min_value=1)
    title = StringField(required=True, max_length=MAX_STEP_TITLE_LENGTH)
    description = StringField(default="", max_length=MAX_STEP_DESCRIPTION_LENGTH)


class WorkflowTemplate(TimestampedDocument):
    meta = {"collection": "workflow_templates"}

    name = StringField(required=True, max_length=MAX_NAME_LENGTH)
    service_id = ObjectIdField(db_field="serviceId", null=True, default=None)
    steps = EmbeddedDocumentListField(TemplateStep, default=list)


class InstanceStep(EmbeddedDocument):
    order = IntField(required=True, min_value=1)
    title = StringField(required=True, max_length=MAX_STEP_TITLE_LENGTH)
    description = StringField(default="", max_length=MAX_STEP_DESCRIPTION_LENGTH)
    done = BooleanField(default=False)
    done_at = DateTimeField(db_field="doneAt", null=True, default=None)
    done_by_name = StringField(db_field="doneByName", default="", max_length=MAX_ACTOR_NAME_LENGTH)


class WorkflowInstance(TimestampedDocument):
    meta = {
        "collection": "workflow_instances",
        "indexes": [{"fields": ["incident_id"], "name": "incident_idx"}],
    }

    incident_id = ObjectIdField(db_field="incidentId", required=True)
    template_id = ObjectIdField(db_field="templateId", required=True)
    template_name = StringField(db_field="templateName", max_length=MAX_NAME_LENGTH)
    steps = EmbeddedDocumentListField(InstanceStep, default=list)
