from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io

from ...core.database import get_db
from ...core.security import get_current_user, require_role, hash_password
from ...models.user import User
from ...models.goal import Cycle, GoalSheet, ThrustArea
from ...models.audit import AuditLog
from ...models.escalation import EscalationRule, EscalationEvent
from ...schemas.user import UserRead, UserSummary
from ...schemas.admin import (
    UserCreate, UserUpdate, CycleCreate, CycleUpdate,
    AuditLogRead, CompletionStat, EscalationRuleUpdate,
)
from ...schemas.goal import ThrustAreaRead, CycleRead
from ...services import report_service

router = APIRouter(prefix="/admin", tags=["admin"])

# All routes in this file require admin role
admin_only = Depends(require_role("admin"))


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserRead])
def list_users(
    role: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    _=admin_only,
):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if department:
        q = q.filter(User.department == department)
    return q.order_by(User.name).all()


@router.post("/users", response_model=UserRead, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), _=admin_only):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.role not in ("employee", "manager", "admin"):
        raise HTTPException(status_code=400, detail="Role must be employee, manager, or admin")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
        department=body.department,
        manager_id=body.manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), _=admin_only):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(user, field, val)

    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}/direct-reports", response_model=List[UserSummary])
def direct_reports(user_id: int, db: Session = Depends(get_db), _=admin_only):
    return db.query(User).filter(User.manager_id == user_id, User.is_active == True).all()


# ── Cycle Management ──────────────────────────────────────────────────────────

@router.post("/cycles", response_model=CycleRead, status_code=201)
def create_cycle(body: CycleCreate, db: Session = Depends(get_db), _=admin_only):
    existing = db.query(Cycle).filter(Cycle.year == body.year, Cycle.phase == body.phase).first()
    if existing:
        raise HTTPException(status_code=409, detail="Cycle already exists for this year and phase")

    if body.is_active:
        db.query(Cycle).filter(Cycle.is_active == True).update({"is_active": False})

    cycle = Cycle(**body.model_dump())
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.patch("/cycles/{cycle_id}", response_model=CycleRead)
def update_cycle(cycle_id: int, body: CycleUpdate, db: Session = Depends(get_db), _=admin_only):
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    if body.is_active:
        db.query(Cycle).filter(Cycle.is_active == True, Cycle.id != cycle_id).update({"is_active": False})

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(cycle, field, val)

    db.commit()
    db.refresh(cycle)
    return cycle


# ── Thrust Area Management ────────────────────────────────────────────────────

@router.post("/thrust-areas", response_model=ThrustAreaRead, status_code=201)
def create_thrust_area(name: str, description: Optional[str] = None, db: Session = Depends(get_db), _=admin_only):
    if db.query(ThrustArea).filter(ThrustArea.name == name).first():
        raise HTTPException(status_code=409, detail="Thrust area already exists")
    ta = ThrustArea(name=name, description=description)
    db.add(ta)
    db.commit()
    db.refresh(ta)
    return ta


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogRead])
def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    changed_by: Optional[int] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _=admin_only,
):
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    if changed_by:
        q = q.filter(AuditLog.changed_by == changed_by)
    return q.order_by(AuditLog.changed_at.desc()).offset(offset).limit(limit).all()


# ── Completion Dashboard ──────────────────────────────────────────────────────

@router.get("/completion-dashboard")
def completion_dashboard(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    _=admin_only,
):
    """Real-time view of which employees have completed submissions and check-ins."""
    employees = db.query(User).filter(User.role == "employee", User.is_active == True).all()
    results = []

    for emp in employees:
        sheet = db.query(GoalSheet).filter(
            GoalSheet.employee_id == emp.id,
            GoalSheet.cycle_id == cycle_id,
        ).first()

        results.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "department": emp.department,
            "manager": emp.manager.name if emp.manager else None,
            "sheet_status": sheet.status.value if sheet else "not_started",
            "goals_count": len(sheet.goals) if sheet else 0,
            "has_checkin_comment": len(sheet.checkin_comments) > 0 if sheet else False,
            "submitted_at": sheet.submitted_at.isoformat() if sheet and sheet.submitted_at else None,
            "approved_at": sheet.approved_at.isoformat() if sheet and sheet.approved_at else None,
        })

    total = len(results)
    approved = sum(1 for r in results if r["sheet_status"] == "approved")
    submitted = sum(1 for r in results if r["sheet_status"] == "submitted")
    not_started = sum(1 for r in results if r["sheet_status"] == "not_started")

    return {
        "cycle_id": cycle_id,
        "summary": {
            "total_employees": total,
            "approved": approved,
            "submitted": submitted,
            "not_started": not_started,
            "completion_rate_pct": round((approved / total * 100), 1) if total else 0,
        },
        "employees": results,
    }


# ── Reports ───────────────────────────────────────────────────────────────────

@router.get("/reports/achievement/csv")
def achievement_csv(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    _=admin_only,
):
    data = report_service.generate_achievement_csv(cycle_id, db)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=achievement_report_cycle{cycle_id}.csv"},
    )


@router.get("/reports/achievement/excel")
def achievement_excel(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    _=admin_only,
):
    data = report_service.generate_achievement_excel(cycle_id, db)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=achievement_report_cycle{cycle_id}.xlsx"},
    )


@router.get("/reports/completion/excel")
def completion_excel(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    _=admin_only,
):
    data = report_service.generate_completion_excel(cycle_id, db)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=completion_dashboard_cycle{cycle_id}.xlsx"},
    )


# ── Escalation Rule Management ────────────────────────────────────────────────

@router.get("/escalation-rules")
def list_escalation_rules(db: Session = Depends(get_db), _=admin_only):
    return db.query(EscalationRule).all()


@router.patch("/escalation-rules/{rule_id}")
def update_escalation_rule(
    rule_id: int,
    body: EscalationRuleUpdate,
    db: Session = Depends(get_db),
    _=admin_only,
):
    rule = db.query(EscalationRule).filter(EscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(rule, field, val)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/escalation-events")
def list_escalation_events(
    is_resolved: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=admin_only,
):
    q = db.query(EscalationEvent)
    if is_resolved is not None:
        q = q.filter(EscalationEvent.is_resolved == is_resolved)
    return q.order_by(EscalationEvent.triggered_at.desc()).all()


@router.post("/test-email")
def test_email(to: str, _=admin_only):
    """Send a test email to verify SendGrid is configured correctly."""
    from ...services.notification_service import _send
    _send(to, "Test Email", "<p>AtomQuest email is working correctly. ✅</p>")
    return {"message": f"Test email sent to {to}. Check your inbox and server logs."}


@router.post("/escalation/run-now")
def trigger_escalation_manually(_=admin_only):
    """
    Manually trigger all escalation checks immediately.
    Useful for demos and testing without waiting for the 6-hour schedule.
    """
    from ...services.escalation_service import run_all_checks
    run_all_checks()
    return {"message": "Escalation checks completed. Check /admin/escalation-events for results."}
