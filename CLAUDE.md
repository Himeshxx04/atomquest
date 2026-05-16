# AtomQuest Hackathon 1.0 — Goal Setting & Tracking Portal

## Project Overview
A full-stack web portal for employee goal setting, approval, tracking, and analytics.
Solo project. 40-hour hackathon window.

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | FastAPI (Python) | Fast, async, auto-docs, familiar |
| Database | PostgreSQL | Relational data, complex queries, audit trails |
| ORM | SQLAlchemy + Alembic | Migrations, type safety |
| Auth | JWT (python-jose) + bcrypt | Stateless, role-based |
| Background Jobs | APScheduler | Escalation engine, no Celery overhead |
| Cache | Redis | Session store, SSE pub/sub |
| Frontend | React + TypeScript + Vite | Fast dev, type safety |
| UI Library | Shadcn/UI + TailwindCSS | Enterprise-grade components in hours |
| Charts | Recharts | Best React-native charting |
| Excel Export | openpyxl | CSV/Excel reports (BRD requirement) |
| Email | SendGrid | Notifications |
| SSO | MSAL (Microsoft Entra ID / Azure AD) | Bonus feature |
| Hosting | Railway (backend+DB+Redis) + Vercel (frontend) | Free tier, fast deploy |

## Project Structure
```
D:\atomquest\
├── backend\
│   ├── app\
│   │   ├── api\routes\      # All FastAPI route handlers
│   │   ├── core\            # Config, DB, Security
│   │   ├── models\          # SQLAlchemy ORM models
│   │   ├── schemas\         # Pydantic request/response schemas
│   │   ├── services\        # Business logic layer
│   │   ├── scheduler\       # APScheduler escalation tasks
│   │   └── main.py          # FastAPI app entry point
│   ├── alembic\             # DB migrations
│   ├── requirements.txt
│   └── .env                 # (gitignored) secrets
├── frontend\
│   ├── src\
│   │   ├── components\      # Reusable UI components
│   │   ├── pages\           # Employee / Manager / Admin views
│   │   ├── hooks\           # Custom React hooks
│   │   ├── store\           # Zustand global state
│   │   └── lib\             # API client, auth helpers
│   └── package.json
└── CLAUDE.md                # This file
```

## User Roles
| Role | What They Can Do |
|---|---|
| employee | Create/edit goals pre-approval, view locked goals, enter quarterly actuals |
| manager | Review & approve/return goals, view team dashboard, log check-in comments |
| admin | Manage org hierarchy, configure cycles, unlock goals, view audit logs |

## BRD Validation Rules (MUST enforce on both frontend AND backend)
- Total weightage across all goals in a sheet = exactly 100%
- Minimum weightage per individual goal: 10%
- Maximum number of goals per employee: 8
- Goals are locked after manager approval — only Admin can unlock
- Shared goals: recipients can only change their weightage, not title/target

## UoM Progress Score Formulas
| UoM Type | Logic | Formula |
|---|---|---|
| min | Higher is better (e.g., Revenue) | Achievement ÷ Target × 100 |
| max | Lower is better (e.g., TAT, Cost) | Target ÷ Achievement × 100 |
| timeline | Date-based | 100 if completed on/before deadline, else 0 |
| zero | Zero = success (e.g., Safety incidents) | If actual = 0 → 100%, else 0% |

## Check-in Calendar
| Period | Window Opens | Action |
|---|---|---|
| Phase 1 (Goal Setting) | 1st May | Goal creation, submission & approval |
| Q1 Check-in | July | Planned vs. Actual update |
| Q2 Check-in | October | Planned vs. Actual update |
| Q3 Check-in | January | Planned vs. Actual update |
| Q4 / Annual | March/April | Final achievement capture |

## Bonus Features Being Built
1. Analytics Module — QoQ trends, heatmaps, manager effectiveness
2. Escalation Module — rule-based auto-reminders via APScheduler
3. Email Notifications — SendGrid for key events
4. Microsoft Entra ID SSO — MSAL.js + Azure AD with regular-login fallback

## Evaluation Criteria (6 equal-weight parameters)
1. Functionality — end-to-end flows work
2. BRD Adherence — all validation rules enforced
3. User Friendliness — intuitive, helpful error messages
4. Bug-Free — edge cases handled
5. Bonus Features — depth and quality
6. Cost Optimization — efficient infra, caching, API efficiency

## Submission Deliverables
- [ ] Live demo URL (Railway + Vercel)
- [ ] GitHub repository
- [ ] Architecture diagram (PDF/image)
- [ ] Login credentials for all 3 roles OR role-switch demo button

## Build Progress

### ✅ Feature 1 — Project Skeleton & Database Models
- Directory structure created
- requirements.txt with all dependencies
- .env.example with all required env vars
- core/config.py — Settings via pydantic-settings
- core/database.py — SQLAlchemy engine + session factory
- core/security.py — JWT creation/decode, bcrypt, role-based dependency
- models/user.py — User table (id, name, email, role, manager_id, azure_oid)
- models/goal.py — GoalSheet, Goal, SharedGoal, QuarterlyActual, CheckinComment, Cycle, ThrustArea
- models/audit.py — AuditLog table (who changed what and when)
- models/escalation.py — EscalationRule + EscalationEvent tables
- alembic setup with env.py wired to models

### ✅ Feature 2 — Auth Routes (login, Azure SSO, role-switch)
- schemas/user.py — UserCreate, UserRead, LoginRequest, TokenResponse, DemoSwitchRequest
- services/auth_service.py — login, azure SSO upsert, demo role-switch, token issuance
- api/routes/auth.py — POST /auth/login, POST /auth/azure, POST /auth/demo-switch, GET /auth/me
- scripts/seed.py — creates 3 demo users, 5 thrust areas, 5 cycles, 3 escalation rules

### ✅ Feature 3 — Goal CRUD + BRD Validation
- schemas/goal.py — all goal/sheet/checkin/shared-goal Pydantic schemas with inline validation
- services/goal_service.py — BRD rules, progress score engine, shared goal sync, audit logging
- api/routes/goals.py — 18 endpoints covering full goal lifecycle
- Key rules enforced: max 8 goals, min 10% weightage, total=100% on submit, lock on approval, shared goal sync

### ✅ Feature 4 — Admin Routes + Reports
- schemas/admin.py — UserCreate/Update, CycleCreate/Update, AuditLogRead, CompletionStat
- services/report_service.py — color-coded Excel + CSV for achievement & completion reports
- api/routes/admin.py — user mgmt, cycle mgmt, thrust areas, audit log, completion dashboard, reports, escalation rule config
### 🔲 Feature 5 — Escalation Engine (APScheduler)
### 🔲 Feature 6 — Email Notifications (SendGrid)
### 🔲 Feature 7 — Analytics Module
### 🔲 Feature 8 — Frontend Scaffold + Auth UI
### 🔲 Feature 9 — Employee Dashboard
### 🔲 Feature 10 — Manager Dashboard
### 🔲 Feature 11 — Admin Dashboard
### 🔲 Feature 12 — Analytics UI (charts, heatmaps)
### 🔲 Feature 13 — Azure AD SSO (MSAL.js)
### 🔲 Feature 14 — Deployment (Railway + Vercel)
### 🔲 Feature 14 — Manager Dashboard
### 🔲 Feature 15 — Admin Dashboard
### 🔲 Feature 16 — Analytics UI (charts, heatmaps)
### 🔲 Feature 17 — Azure AD SSO (MSAL.js)
### 🔲 Feature 18 — Deployment (Railway + Vercel)
