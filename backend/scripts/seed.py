import os
import sys
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pagerduty_backend.settings")

import django

django.setup()

import bcrypt

from apps.alerts.models import AlertEvent
from apps.escalations.models import EscalationPolicy
from apps.incidents.models import Incident
from apps.incidents.services import timeline_entry
from apps.oncall import repository as oncall_repository
from apps.oncall.models import Schedule, ScheduleOverride
from apps.oncall.services import rotation_responder_id
from apps.responders.models import Responder
from apps.services.models import Service
from apps.services.services import generate_integration_key
from apps.shared.documents import now_utc
from apps.workflows.models import WorkflowInstance, WorkflowTemplate
from scripts.seed_data import (
    DEMO_PASSWORD,
    ESCALATION_POLICIES,
    INCIDENTS,
    OVERRIDES,
    PASSWORD_ROUNDS,
    RESPONDERS,
    SCHEDULES,
    SERVICES,
    WORKFLOW_TEMPLATES,
)

SEPARATOR = "========================================"
AVATAR_PALETTE = ["#4f46e5", "#0891b2", "#b45309", "#be185d", "#16a34a", "#7c3aed", "#dc2626", "#0d9488", "#334155"]


def log(message):
    print(message)


def clear_collections():
    for model in (Incident, AlertEvent, WorkflowInstance, WorkflowTemplate, EscalationPolicy, ScheduleOverride, Schedule, Service, Responder):
        model.drop_collection()


def seed_responders():
    password_hash = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt(rounds=PASSWORD_ROUNDS)).decode()
    by_email = {}

    for index, row in enumerate(RESPONDERS):
        responder = Responder(
            name=row["name"],
            email=row["email"],
            password_hash=password_hash,
            role=row["role"],
            title=row["title"],
            phone=row["phone"],
            avatar_color=AVATAR_PALETTE[index % len(AVATAR_PALETTE)],
        ).save()
        by_email[row["email"]] = responder

    log(f"Seeded {len(by_email)} responders")

    return by_email


def seed_schedules(responders_by_email):
    now = now_utc()
    by_name = {}

    for row in SCHEDULES:
        schedule = Schedule(
            name=row["name"],
            description=row["description"],
            time_zone=row["time_zone"],
            responder_ids=[responders_by_email[email].id for email in row["responder_emails"]],
            rotation_type=row["rotation_type"],
            shift_length_hours=row["shift_length_hours"],
            handoff_time=row["handoff_time"],
            rotation_start_at=now - timedelta(days=row["rotation_start_days_ago"]),
        ).save()
        by_name[row["name"]] = schedule

    log(f"Seeded {len(by_name)} on-call schedules")

    return by_name


def seed_overrides(schedules_by_name, responders_by_email):
    now = now_utc()

    for row in OVERRIDES:
        start_at = now + timedelta(days=row["start_days_from_now"])
        ScheduleOverride(
            schedule_id=schedules_by_name[row["schedule_name"]].id,
            responder_id=responders_by_email[row["responder_email"]].id,
            start_at=start_at,
            end_at=start_at + timedelta(hours=row["duration_hours"]),
            reason=row["reason"],
        ).save()

    log(f"Seeded {len(OVERRIDES)} schedule overrides")


def seed_escalation_policies(schedules_by_name, responders_by_email):
    by_name = {}

    for row in ESCALATION_POLICIES:
        levels = []

        for index, level in enumerate(row["levels"]):
            if level["target_type"] == "schedule":
                target_id = schedules_by_name[level["target_name"]].id
            else:
                target_id = responders_by_email[level["target_email"]].id

            levels.append({"order": index + 1, "target_type": level["target_type"], "target_id": target_id, "timeout_minutes": level["timeout_minutes"]})

        policy = EscalationPolicy(name=row["name"], description=row["description"], levels=levels).save()
        by_name[row["name"]] = policy

    log(f"Seeded {len(by_name)} escalation policies")

    return by_name


def seed_workflow_templates():
    by_name = {}

    for row in WORKFLOW_TEMPLATES:
        steps = [{"order": index + 1, "title": step["title"], "description": step["description"]} for index, step in enumerate(row["steps"])]
        template = WorkflowTemplate(name=row["name"], service_id=None, steps=steps).save()
        by_name[row["name"]] = template

    log(f"Seeded {len(by_name)} workflow templates")

    return by_name


def seed_services(responders_by_email, policies_by_name, templates_by_name):
    by_name = {}

    for row in SERVICES:
        service = Service(
            name=row["name"],
            description=row["description"],
            owner_id=responders_by_email[row["owner_email"]].id,
            integration_key=generate_integration_key(),
            escalation_policy_id=policies_by_name[row["escalation_policy"]].id if row["escalation_policy"] else None,
            workflow_template_id=templates_by_name[row["workflow_template"]].id if row["workflow_template"] else None,
            default_urgency=row["default_urgency"],
        ).save()
        by_name[row["name"]] = service

    log(f"Seeded {len(by_name)} services")

    return by_name


def resolve_level_one_assignee(policy, at_moment):
    if policy is None:
        return None

    level = next((item for item in policy.levels if item.order == 1), None)

    if level is None:
        return None

    if level.target_type == "responder":
        return level.target_id

    schedule = oncall_repository.find_by_id(str(level.target_id))

    return rotation_responder_id(schedule, at_moment) if schedule else None


def seed_incidents(services_by_name, responders_by_email, templates_by_name, policies_by_id):
    responders_by_id = {str(responder.id): responder for responder in responders_by_email.values()}
    templates_by_id = {str(template.id): template for template in templates_by_name.values()}

    def actor_for(responder_id):
        if responder_id is None:
            return None

        responder = responders_by_id.get(str(responder_id))

        return {"_id": responder_id, "name": responder.name} if responder else None

    created = []

    for row in INCIDENTS:
        service = services_by_name[row["service"]]
        policy = policies_by_id.get(str(service.escalation_policy_id)) if service.escalation_policy_id else None
        created_at = now_utc() - timedelta(days=row["days_ago"], hours=row.get("hours_ago", 0))

        if row["assignee_email"]:
            assignee_id = responders_by_email[row["assignee_email"]].id
        elif row["status"] == "triggered" and policy is not None:
            assignee_id = resolve_level_one_assignee(policy, created_at)
        else:
            assignee_id = None

        has_assignment = assignee_id is not None and policy is not None
        timeline = [timeline_entry("triggered", f"Triggered by monitoring: {row['description']}", None, at_moment=created_at)]
        acknowledged_at = None
        resolved_at = None

        if row["ack_minutes_after"] is not None:
            acknowledged_at = created_at + timedelta(minutes=row["ack_minutes_after"])
            timeline.append(
                timeline_entry("acknowledged", f"Acknowledged by {responders_by_id[str(assignee_id)].name}.", actor_for(assignee_id), at_moment=acknowledged_at)
            )

        if row["resolve_minutes_after"] is not None:
            resolved_at = created_at + timedelta(minutes=row["resolve_minutes_after"])
            timeline.append(
                timeline_entry("resolved", f"Resolved by {responders_by_id[str(assignee_id)].name}.", actor_for(assignee_id), at_moment=resolved_at)
            )

        incident = Incident(
            service_id=service.id,
            title=row["title"],
            description=row["description"],
            status=row["status"],
            urgency=row["urgency"],
            assignee_id=assignee_id,
            escalation_policy_id=service.escalation_policy_id,
            current_level=1 if has_assignment else 0,
            event_ids=[],
            timeline=timeline,
            acknowledged_at=acknowledged_at,
            resolved_at=resolved_at,
            last_escalated_at=created_at if has_assignment else None,
            created_at=created_at,
        ).save()

        if row["workflow"] and service.workflow_template_id:
            template = templates_by_id[str(service.workflow_template_id)]
            steps = []

            for step in sorted(template.steps, key=lambda item: item.order):
                done = step.order <= row["workflow_done_steps"]
                steps.append(
                    {
                        "order": step.order,
                        "title": step.title,
                        "description": step.description,
                        "done": done,
                        "done_at": created_at + timedelta(minutes=15 * step.order) if done else None,
                        "done_by_name": responders_by_id[str(assignee_id)].name if done and assignee_id else "",
                    }
                )

            WorkflowInstance(
                incident_id=incident.id, template_id=template.id, template_name=template.name, steps=steps, created_at=created_at
            ).save()

        created.append((incident, row, service, created_at))

    log(f"Seeded {len(created)} incidents")

    return created


def seed_alert_events(created_incidents):
    count = 0

    for index, (incident, row, service, created_at) in enumerate(created_incidents):
        severity = "critical" if row["urgency"] == "high" else "warning"
        dedup_key = f"datadog:{row['title']}".lower()
        AlertEvent(
            service_id=service.id,
            incident_id=incident.id,
            source="datadog",
            summary=row["title"],
            severity=severity,
            dedup_key=dedup_key,
            status="triaged",
            occurrence_count=3 if index % 3 == 0 else 1,
            payload={"metric": "synthetic-seed-monitor", "condition": row["title"], "urgency": row["urgency"]},
            received_at=created_at + timedelta(minutes=2 if index % 3 == 0 else 0),
            created_at=created_at,
        ).save()
        count += 1

    log(f"Seeded {count} alert events")


def main():
    log(SEPARATOR)
    log("Seeding incident management database")
    log(SEPARATOR)

    clear_collections()
    responders_by_email = seed_responders()
    schedules_by_name = seed_schedules(responders_by_email)
    seed_overrides(schedules_by_name, responders_by_email)
    policies_by_name = seed_escalation_policies(schedules_by_name, responders_by_email)
    policies_by_id = {str(policy.id): policy for policy in policies_by_name.values()}
    templates_by_name = seed_workflow_templates()
    services_by_name = seed_services(responders_by_email, policies_by_name, templates_by_name)
    created_incidents = seed_incidents(services_by_name, responders_by_email, templates_by_name, policies_by_id)
    seed_alert_events(created_incidents)

    log(SEPARATOR)
    log(f"Seed login: {RESPONDERS[0]['email']} / {DEMO_PASSWORD}")
    log(SEPARATOR)


if __name__ == "__main__":
    main()
