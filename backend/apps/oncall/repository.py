from bson import ObjectId

from .models import Schedule, ScheduleOverride

SORT_ORDER = ["name"]


def find_all():
    return list(Schedule.objects(__raw__={}).order_by(*SORT_ORDER).as_pymongo())


def find_by_id(schedule_id):
    return Schedule.objects(__raw__={"_id": ObjectId(schedule_id)}).as_pymongo().first()


def find_existing(ids):
    identifiers = [ObjectId(value) for value in dict.fromkeys(str(value) for value in ids)]

    return list(Schedule.objects(__raw__={"_id": {"$in": identifiers}}).as_pymongo())


def create(values):
    return Schedule(**values).save().to_mongo()


def update(schedule_id, values):
    schedule = Schedule.objects(id=ObjectId(schedule_id)).first()

    if schedule is None:
        return None

    for field, value in values.items():
        setattr(schedule, field, value)

    schedule.save()

    return schedule.to_mongo()


def delete(schedule_id):
    schedule = Schedule.objects(id=ObjectId(schedule_id)).first()

    if schedule is None:
        return False

    schedule.delete()

    return True


def find_overrides(schedule_id):
    return list(
        ScheduleOverride.objects(__raw__={"scheduleId": ObjectId(schedule_id)}).order_by("start_at").as_pymongo()
    )


def find_overrides_in_range(schedule_id, from_moment, to_moment):
    conditions = {
        "scheduleId": ObjectId(schedule_id),
        "startAt": {"$lt": to_moment},
        "endAt": {"$gt": from_moment},
    }

    return list(ScheduleOverride.objects(__raw__=conditions).order_by("start_at").as_pymongo())


def find_active_override(schedule_id, at_moment):
    conditions = {"scheduleId": ObjectId(schedule_id), "startAt": {"$lte": at_moment}, "endAt": {"$gt": at_moment}}

    return ScheduleOverride.objects(__raw__=conditions).order_by("-created_at").as_pymongo().first()


def create_override(values):
    return ScheduleOverride(**values).save().to_mongo()


def find_override_by_id(override_id):
    return ScheduleOverride.objects(__raw__={"_id": ObjectId(override_id)}).as_pymongo().first()


def delete_override(override_id):
    override = ScheduleOverride.objects(id=ObjectId(override_id)).first()

    if override is None:
        return False

    override.delete()

    return True
