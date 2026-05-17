# GoalFlow — Goal Setting & Performance Tracking Portal

> **AtomQuest Hackathon 1.0 Submission**

A full-stack BRD-compliant goal management portal for enterprise performance tracking — from goal creation through quarterly check-ins to final appraisal.

---

## 🔗 Live Demo

| Service | URL |
|---------|-----|
| Frontend | *(coming soon — Render)* |
| Backend API | *(coming soon — Render)* |
| API Docs | `{backend-url}/docs` |

---

## 🎭 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | Employee@123 |
| Manager | manager@demo.com | Manager@123 |
| Admin | admin@demo.com | Admin@123 |

> **Role switching shortcut**: Use the demo switch buttons on the login page to instantly jump between all three roles without re-entering credentials.

> **Microsoft SSO**: Click "Sign in with Microsoft" to authenticate via Azure AD. Any Microsoft/Outlook/organizational account is accepted. Role is auto-assigned from Azure AD group membership.

---

## ✨ Features

### Core Workflows (Phase 1 — Goal Creation & Approval)
- **Employee**: Create goal sheets, add up to 8 goals per cycle, assign thrust areas and UoM types (Min/Max/Timeline/Zero), set targets and weightage
- **Validation**: 10% minimum per goal, 100% total required before submission, max 8 goals enforced
- **Manager**: Review submitted sheets, inline-edit targets and weightage, approve (locks goals) or return with reason
- **Shared Goals**: Admin/Manager pushes departmental KPIs to employees; recipients adjust weightage only
- **Goal locking**: All goals locked post-approval; admin can unlock individually for exceptions

### Core Workflows (Phase 2 — Achievement Tracking)
- **Quarterly check-ins**: Employees log actuals (Q1–Q4) with status (Not Started / On Track / Completed)
- **Score formulas**: Min (higher=better), Max (lower=better), Timeline (date-based), Zero (0=100%)
- **Manager check-ins**: Structured per-quarter feedback comments on approved sheets
- **Completion dashboard**: Real-time org-wide submission and check-in status for admins

### Reporting & Governance
- **Achievement reports**: Export as CSV or Excel (openpyxl) with planned vs actual breakdown
- **Audit trail**: Every post-lock change logged with who/what/when
- **Escalation engine**: APScheduler runs every 6 hours — flags employees who haven't submitted, managers who haven't approved, and missed check-in windows

### Bonus Features
#### 5.1 — Microsoft Entra ID (Azure AD) SSO
- MSAL v5 loginRedirect flow with `prompt: select_account`
- Accepts any Microsoft/Outlook/organizational account (`/common` authority)
- Syncs org hierarchy from Graph API (`/me/manager`)
- Auto-assigns role from Azure AD group names (`admin/hr` → admin, `manager/lead` → manager)
- `AZURE_ADMIN_EMAILS` env var for designated admin override

#### 5.2 — Email Notifications (SendGrid)
- Goal submitted → manager receives email
- Goal approved → employee receives email
- Goal returned → employee receives email with return reason
- Escalation breach → notification chain (employee → manager → HR)

#### 5.3 — Escalation Module
- Rule-based engine: configurable `threshold_days` per trigger type
- Triggers: not submitted / not approved / check-in not completed
- `notify_chain`: comma-separated escalation chain
- EscalationEvent log visible to admin (open + resolved)

#### 5.4 — Analytics Module
- Quarter-on-Quarter trend lines (individual + team level)
- Completion heatmap (department × quarter)
- Goal distribution by thrust area and UoM type
- Manager effectiveness dashboard (approval rate, avg approval days, check-in rate)

---

## 🏗️ Architecture

See **[ARCHITECTURE.html](./ARCHITECTURE.html)** for the full interactive architecture diagram covering all layers, data flows, and external integrations.

**Stack summary:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Zustand, React Router v6, Recharts, MSAL v5 |
| Backend | FastAPI, Python 3.11+, SQLAlchemy 2.0, Pydantic v2, APScheduler, Alembic |
| Database | PostgreSQL 15 |
| Auth | JWT (HS256) + Microsoft Entra ID SSO (OIDC) |
| Email | SendGrid API |
| Org Hierarchy | Microsoft Graph API |

---

## 🚀 Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Run migrations and seed demo data
alembic upgrade head
python scripts/seed.py

# Start server
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000` — API docs at `/docs`.

### Frontend

```bash
cd frontend
npm install

# Copy and fill in environment variables
cp .env.example .env

npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/atomquest
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development

# Azure AD SSO (Bonus 5.1)
AZURE_CLIENT_ID=your-azure-client-id
AZURE_TENANT_ID=your-azure-tenant-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_ADMIN_EMAILS=admin@yourdomain.com

# Email notifications (Bonus 5.2)
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourdomain.com

FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
VITE_AZURE_CLIENT_ID=your-azure-client-id
VITE_AZURE_TENANT_ID=your-azure-tenant-id
```

---

## 📁 Project Structure

```
atomquest/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # auth, goals, admin, analytics
│   │   ├── core/            # config, database, security
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # business logic, notifications, escalation
│   ├── alembic/             # DB migrations
│   └── scripts/seed.py      # Demo data seeder
├── frontend/
│   └── src/
│       ├── pages/           # auth, employee, manager, admin
│       ├── store/           # Zustand auth store
│       ├── lib/             # Axios instance
│       └── components/      # Layout, shared components
├── ARCHITECTURE.html        # Interactive architecture diagram
└── README.md
```

---

## 👥 Team

Built for **AtomQuest Hackathon 1.0**
