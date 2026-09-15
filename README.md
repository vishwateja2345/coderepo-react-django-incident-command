<h1 align="center">Incident Command</h1>

<p align="center">
  A PagerDuty-inspired incident management platform for on-call teams: receive monitoring events, triage and
  resolve incidents, run on-call rotations, and learn from post-incident data.
</p>

## What this is

Incident Command helps SRE and DevOps teams register the services they operate, accept alerts from monitoring
tools, group and deduplicate the noise into actionable incidents, route them through on-call schedules and
escalation policies, run a response checklist, and review how the team performed afterward. It is a full-stack
product: every capability below has a real screen, a real API call, a real backend handler, and MongoDB-backed
data — nothing is mocked or hardcoded.

### Core features

1. **Service & event management** — register services with an owner, an integration key, a default urgency, an
   escalation policy, and an optional response runbook. Monitoring tools post events to `POST /api/v1/events/{integrationKey}`.
2. **Alert triage** — incoming events are deduplicated against recent matches (configurable window) and grouped
   under one incident per service/time window instead of spawning a new incident per alert.
3. **Incident management** — open, acknowledge, assign, add notes, escalate, and resolve incidents, with every
   transition recorded on an audit timeline.
4. **On-call scheduling** — build rotations with an ordered responder list, shift length, handoff time, and time
   zone, with temporary overrides for a day, a shift, or a week.
5. **Escalation policies** — an ordered list of levels (a responder or an on-call schedule) with a timeout per
   level. An unacknowledged incident automatically advances to the next level once its timeout elapses.
6. **Incident workflows (runbooks)** — attach a response checklist template to a service; every incident opened
   for that service gets its own copy of the checklist to track through resolution.
7. **Stakeholder communication** — post customer-facing status updates on an incident, and show a status page
   that summarizes current health per service from open incidents.
8. **Post-incident analytics** — time-to-acknowledge and time-to-resolve per incident, summarized per service and
   per responder, plus a trend view over time.

### A note on escalation timing

This environment has no background job runner or WebSocket channel available to it (see `hackerrank.yml` / the
HackerRank runtime contract), so escalation is evaluated lazily: whenever incidents are listed or fetched, the
backend checks every unacknowledged incident against its escalation policy and advances it through every level
whose timeout has elapsed, using the level's own timeout as the scheduled time for the *next* check — so an
incident that has sat untouched escalates through every level it should already have passed, with historically
accurate timeline timestamps, rather than skipping straight to "now." The frontend polls the incident list every
15 seconds so this reads as close to real time without any additional infrastructure. A production deployment
with a real task queue would instead run this on a timer independent of reads; that tradeoff is intentional here.

## Technology stack

- [React 19](https://react.dev/) and [Vite 8](https://vite.dev/) for the frontend, no router — navigation is
  simple top-level state in `App.jsx` plus per-page local state, matching the size of the app.
- [Bun](https://bun.sh/) for JavaScript workspace installation.
- [Python 3.12](https://www.python.org/), [Django 5.1](https://www.djangoproject.com/), and
  [Django REST Framework](https://www.django-rest-framework.org/) for routing, request/response handling, and a
  shared exception-to-HTTP-status mapping. DRF serializers are not used; validation is hand-written per feature.
- [MongoDB](https://www.mongodb.com/) and [MongoEngine](https://mongoengine.org/) for persistence — no Django ORM,
  no SQL. Simple documents use MongoEngine's query API; multi-field atomic updates (timeline appends, escalation
  advances, workflow step toggles) use raw `pymongo` operators against the MongoEngine-managed collection.
- [PyJWT](https://pyjwt.readthedocs.io/) and [bcrypt](https://pypi.org/project/bcrypt/) for authentication (bearer
  JWT sessions, bcrypt-hashed passwords).
- Hand-authored validation (`apps/shared/validation.py`) and error handling (`apps/shared/errors.py`) shared by
  every backend feature, and a hand-authored SVG icon set / CSS design system on the frontend — no UI component
  library, no charting library, no ESLint/Prettier-plugin additions beyond what a plain Prettier config needs.

## Project structure

```text
.
├── backend/
│   ├── apps/
│   │   ├── auth/              # Login, session, JWT issuing/verification
│   │   ├── responders/        # Team directory (the people who get paged)
│   │   ├── services/          # Service registry, integration keys, derived health status
│   │   ├── alerts/            # Event ingestion, deduplication, alert-to-incident grouping
│   │   ├── incidents/         # Incident lifecycle, timeline, escalation evaluation
│   │   ├── oncall/            # Schedules, rotation math, overrides
│   │   ├── escalations/       # Escalation policies and level resolution
│   │   ├── workflows/         # Runbook templates and per-incident checklist instances
│   │   ├── analytics/         # MTTA/MTTR aggregation, read-only
│   │   ├── statuspage/        # Service health aggregation, read-only
│   │   └── shared/            # Cross-cutting: documents, errors, validation, auth, rendering
│   ├── pagerduty_backend/     # Django settings and URL composition
│   ├── scripts/                # Deterministic seed data (seed.py, seed_data.py)
│   └── public/                 # Static landing page served at `/` by Django
├── frontend/
│   ├── src/features/           # One folder per product feature (auth, incidents, alerts, services,
│   │                             oncall, escalations, workflows, analytics, statuspage, responders, dashboard)
│   ├── src/shared/              # API client, design-system components, formatting/toast utilities
│   └── public/                  # Local static assets (favicon)
├── skills/validate/             # Read-only repository validator (see GUIDELINES.md)
├── transcripts/                 # Transparent notes on the AI-assisted build (see AGENTS.md)
├── .vscode/launch.json          # Django debugger configuration
├── hackerrank.yml                # HackerRank install and run configuration
└── setup.sh                      # MongoDB readiness, Python environment, and seed reset
```

## Prerequisites

- Bun 1.3 or later
- Python 3.12
- [uv](https://docs.astral.sh/uv/)
- MongoDB 7.0+ reachable at `127.0.0.1:27017` (MongoDB 8.0 also works; this environment's sandbox validated
  against 7.0 due to a local kernel/Docker compatibility issue with the 8.0 server image — either version
  satisfies the application's driver usage)

## MongoDB behavior

The backend connects to `MONGODB_URI` (default `mongodb://localhost:27017/pagerduty_db`) once at process start
and exposes connection health at `GET /api/v1/health`, which reports `"database": "connected"` or `"disconnected"`
distinctly from the API process being up. `bun run seed` (invoked automatically by `bash setup.sh` and therefore
by `bun install`'s post-install flow) drops every application collection and reinserts the deterministic seed
baseline described below, so every fresh start returns to the same known state.

## Getting started

### Development setup

1. Clone the repository, then open the project directory.
2. Ensure MongoDB is reachable on `127.0.0.1:27017` (for local development without a system MongoDB install, a
   throwaway container works: `docker run -d --name incident-mongo -p 27017:27017 mongo:7.0`).
3. Install the pinned JavaScript workspace and prepare/seed the backend:

   ```bash
   bun install && bash setup.sh --seed
   ```

4. Start the complete application:

   ```bash
   bun start
   ```

   Startup prepares the Python environment, checks MongoDB, restores the seeded baseline, and launches the
   frontend and backend together.

5. Open [http://localhost:3000](http://localhost:3000) and sign in with a seeded account (see below).

The frontend runs on port `3000`, the API runs on port `8000`, and health is available at
[http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

### Command reference

| Command | Purpose |
|---|---|
| `bun start` | Seeds MongoDB and starts Django and Vite together. |
| `bun run seed` | Restores the deterministic MongoDB baseline. |
| `bun run dev:backend` | Starts only the Django API on port `8000`. |
| `bun run dev:frontend` | Starts only Vite on port `3000`. |
| `bash setup.sh --seed` | Prepares `.env` files, verifies/starts MongoDB, installs Python dependencies, and seeds. |

HackerRank installs the application with `bun install && bash setup.sh --seed` and runs it with `bun start`.

## Seeded access

```text
Email: jordan.blake@northpeak.io
Password: password123
```

Jordan Blake is seeded as an admin (can manage services, schedules, escalation policies, runbooks, and the team
roster); every other seeded responder signs in with the same password and the `responder` role. The seed data
includes 9 responders across SRE, backend, mobile, identity, and security teams; 6 services with varied
escalation policies and runbooks; 3 on-call schedules (daily and weekly rotations, one active override); 3
escalation policies; 3 runbook templates; and 11 incidents spanning the last several weeks — some resolved with
realistic acknowledge/resolve timing, two left open so you can see live escalation and an active checklist.
