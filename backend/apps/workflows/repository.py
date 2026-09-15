from bson import ObjectId
from pymongo import ReturnDocument

from apps.shared.documents import now_utc
from apps.shared.mongo import collection, to_dict

from .models import WorkflowInstance, WorkflowTemplate

SORT_ORDER = ["name"]


def find_templates(service_id=None):
    conditions = {}

    if service_id is not None:
        conditions = {"$or": [{"serviceId": ObjectId(service_id)}, {"serviceId": None}]}

    return list(WorkflowTemplate.objects(__raw__=conditions).order_by(*SORT_ORDER).as_pymongo())


def find_template_by_id(template_id):
    return WorkflowTemplate.objects(__raw__={"_id": ObjectId(template_id)}).as_pymongo().first()


def create_template(values):
    return to_dict(WorkflowTemplate(**values).save())


def update_template(template_id, values):
    template = WorkflowTemplate.objects(id=ObjectId(template_id)).first()

    if template is None:
        return None

    for field, value in values.items():
        setattr(template, field, value)

    template.save()

    return to_dict(template)


def delete_template(template_id):
    return collection(WorkflowTemplate).find_one_and_delete({"_id": ObjectId(template_id)})


def find_instance_by_incident(incident_id):
    return WorkflowInstance.objects(__raw__={"incidentId": ObjectId(incident_id)}).as_pymongo().first()


def find_instance_by_id(instance_id):
    return WorkflowInstance.objects(__raw__={"_id": ObjectId(instance_id)}).as_pymongo().first()


def create_instance(values):
    return to_dict(WorkflowInstance(**values).save())


def update_step(instance_id, order, done, done_by_name):
    moment = now_utc()

    return collection(WorkflowInstance).find_one_and_update(
        {"_id": ObjectId(instance_id), "steps.order": order},
        {
            "$set": {
                "steps.$.done": done,
                "steps.$.doneAt": moment if done else None,
                "steps.$.doneByName": done_by_name if done else "",
                "updatedAt": moment,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
