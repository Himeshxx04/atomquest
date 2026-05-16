# AtomQuest — Goal Setting & Tracking Portal
## Architecture & Design Decisions

### Problem Statement
Organizations relying on spreadsheets and emails for goal tracking face three pain points:
- Managers can't monitor team progress in real time
- Employees don't know how their work connects to company priorities
- HR scrambles to piece together data at appraisal time

This portal digitizes the full goal lifecycle: set → approve → track → review.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | FastAPI (Python) | Async, auto-docs via Swagger, high performance |
| Database | PostgreSQL | Relational integrity, complex queries, audit trails |
| ORM | SQLAlchemy + Alembic | Type-safe migrations, schema version control |
| Auth | JWT (python-jose) + bcrypt | Stateless, role-based, no session storage needed |
| Background Jobs | APScheduler | Escalation engine without Celery overhead |
| Cache | Redis | Session store, real-time pub/sub |
| Frontend | React + TypeScript + Vite | Type safety, fast HMR dev experience |
| UI Library | Shadcn/UI + TailwindCSS | Enterprise-grade components, consistent design system |
| Charts | Recharts | Native React charting, composable API |
| Excel Export | openpyxl | Color-coded reports required by BRD |
| Email | SendGrid | Transactional emails, free tier sufficient |
| SSO | MSAL (Microsoft Entra ID) | Azure AD integration for enterprise auth |
| Hosting | Railway (backend + DB + Redis) + Vercel (frontend) | Zero-config deploy, free tier |

---

## Project Structure

```
atomquest/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # HTTP endpoint handlers
│   │   ├── core/            # Config, DB engine, JWT security
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response validation
│   │   ├── services/        # Business logic layer
│   │   └── scheduler/       # APScheduler escalation jobs
│   ├── alembic/             # Database migrations
│   └── scripts/             # Seed and utility scripts
└── frontend/
    └── src/
        ├── components/      # Reusable UI components
        ├── pages/           # Role-based views (Employee/Manager/Admin)
        ├── hooks/           # Custom React hooks
        ├── store/           # Zustand global state
        └── lib/             # API client, auth helpers
```

---

## Database Schema

### Core Tables
| Table | Purpose |
|---|---|
| users | All users with role, manager hierarchy, Azure OID |
| cycles | Performance periods (goal_setting, Q1–Q4) with date windows |
| thrust_areas | Configurable KPI categories |
| goal_sheets | One per employee per cycle, tracks approval status |
| goals | Individual goals with UoM, target, weightage |
| shared_goals | Links pushed departmental KPIs to recipient employees |
| quarterly_actuals | Employee achievement entries per goal per quarter |
| checkin_comments | Manager structured feedback per quarter |

### Audit & Compliance Tables
| Table | Purpose |
|---|---|
| audit_logs | Every post-lock change: who, what, when |
| escalation_rules | Configurable trigger conditions and thresholds |
| escalation_events | Instances of triggered escalations with resolution tracking |

---

## User Roles & Access Control

| Role | Capabilities |
|---|---|
| employee | Create/edit goals pre-approval, log quarterly actuals, view locked goals |
| manager | Approve/return goal sheets, inline edits during approval, check-in comments |
| admin | Full org management, cycle config, goal unlock, audit logs, reports |

Role enforcement: every API endpoint uses `require_role()` FastAPI dependency — checked server-side on every request, not just the frontend.

---

## BRD Validation Rules

Enforced on both frontend (immediate feedback) and backend (authoritative):

| Rule | Implementation |
|---|---|
| Total weightage = 100% on submit | `abs(total - 100) > 0.01` check before status change |
| Min 10% weightage per goal | DB `CheckConstraint` + Pydantic validator |
| Max 8 goals per employee | Count check before insert |
| Goals locked after approval | `is_locked=True` on all goals atomically |
| Shared goal sync | Achievement update propagates to all recipients in same transaction |
| Admin-only unlock | `require_role("admin")` on unlock endpoint |

---

## Progress Score Formulas (BRD Section 2.2)

| UoM Type | Logic | Formula |
|---|---|---|
| min | Higher is better (e.g. Revenue) | `(achievement / target) × 100` |
| max | Lower is better (e.g. TAT, Cost) | `(target / achievement) × 100` |
| timeline | Date-based | `100 if completed ≤ deadline else 0` |
| zero | Zero = success (e.g. Safety incidents) | `100 if actual == 0 else 0` |

Scores are computed and **stored** in `quarterly_actuals.progress_score` for fast reporting — not recomputed on every query.

---

## Check-in Calendar

| Period | Window | Action |
|---|---|---|
| Phase 1 (Goal Setting) | 1 May | Goal creation, submission & approval |
| Q1 Check-in | July | Planned vs. Actual update |
| Q2 Check-in | October | Planned vs. Actual update |
| Q3 Check-in | January | Planned vs. Actual update |
| Q4 / Annual | March/April | Final achievement capture |

---

## Escalation Engine

Runs every 6 hours via APScheduler (attached to FastAPI lifespan):

```
check_employee_not_submitted  → N days after cycle opens with no submission
check_manager_not_approved    → N days after submission with no approval
check_checkin_not_completed   → N days before window close with no actuals
```

- Thresholds configurable by Admin via `PATCH /admin/escalation-rules/{id}`
- Auto-resolves events when condition clears
- Fires email chain: employee → manager → HR/Admin

---

## Bonus Features Implemented

1. **Analytics Module** — QoQ trend charts, heatmaps, goal distribution, manager effectiveness
2. **Escalation Module** — Rule-based auto-reminders via APScheduler
3. **Email Notifications** — SendGrid for all key events with branded HTML templates
4. **Microsoft Entra ID SSO** — MSAL.js frontend + Azure AD token validation on backend

---

## API Overview

| Prefix | Endpoints | Auth |
|---|---|---|
| `/auth` | login, azure SSO, demo-switch, me | Public / JWT |
| `/goals` | full goal lifecycle, actuals, shared goals | Employee / Manager |
| `/admin` | users, cycles, reports, audit, escalations | Admin only |

Full interactive docs: `GET /docs` (Swagger UI)

---

## Cost Optimisation

- PostgreSQL connection pooling: `pool_size=10, max_overflow=20`
- Progress scores stored on write, not recomputed on read
- APScheduler runs in-process — no separate worker infrastructure
- Redis for caching frequently-read reference data (thrust areas, cycles)
- Railway free tier: 512MB RAM, sufficient for demo load
- Vercel free tier: CDN-distributed frontend, zero cold starts
