"""
Analytics service — powers the bonus analytics module.
All queries are optimised: aggregate in DB, not in Python.

Endpoints served:
  1. QoQ trend        — avg progress score per quarter per dept/individual
  2. Heatmap data     — completion rate by dept × quarter
  3. Goal distribution — count by thrust area / UoM type / status
  4. Manager effectiveness — check-in completion rate per L1 manager
  5. Org overview     — top-level KPIs for admin home dashboard
"""
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from ..models.goal import (
    GoalSheet, Goal, QuarterlyActual, Cycle, ThrustArea,
    SheetStatus, GoalStatus, CyclePhase, UoMType,
)
from ..models.user import User
from ..models.goal import CheckinComment


# ── 1. QoQ Trend ─────────────────────────────────────────────────────────────

def get_qoq_trend(db: Session, department: str = None, employee_id: int = None):
    """Average progress score per check-in quarter, optionally filtered."""
    check_in_phases = [CyclePhase.Q1, CyclePhase.Q2, CyclePhase.Q3, CyclePhase.Q4]

    q = (
        db.query(
            Cycle.phase,
            Cycle.year,
            func.avg(QuarterlyActual.progress_score).label("avg_score"),
            func.count(QuarterlyActual.id).label("entries"),
        )
        .join(QuarterlyActual, QuarterlyActual.cycle_id == Cycle.id)
        .join(Goal, Goal.id == QuarterlyActual.goal_id)
        .join(GoalSheet, GoalSheet.id == Goal.goal_sheet_id)
        .join(User, User.id == GoalSheet.employee_id)
        .filter(
            Cycle.phase.in_(check_in_phases),
            QuarterlyActual.progress_score.isnot(None),
        )
    )

    if department:
        q = q.filter(User.department == department)
    if employee_id:
        q = q.filter(User.id == employee_id)

    rows = q.group_by(Cycle.year, Cycle.phase).order_by(Cycle.year, Cycle.phase).all()

    return [
        {
            "quarter": f"{r.year} {r.phase.value.upper()}",
            "year": r.year,
            "phase": r.phase.value,
            "avg_score": round(float(r.avg_score), 1) if r.avg_score else None,
            "entries": r.entries,
        }
        for r in rows
    ]


# ── 2. Heatmap — completion rate by dept × quarter ───────────────────────────

def get_heatmap(db: Session):
    """Returns a matrix: department × quarter → completion % """
    check_in_phases = [CyclePhase.Q1, CyclePhase.Q2, CyclePhase.Q3, CyclePhase.Q4]

    rows = (
        db.query(
            User.department,
            Cycle.phase,
            Cycle.year,
            func.count(GoalSheet.id).label("total"),
            func.sum(
                case((GoalSheet.status == SheetStatus.APPROVED, 1), else_=0)
            ).label("approved"),
        )
        .join(GoalSheet, GoalSheet.employee_id == User.id)
        .join(Cycle, Cycle.id == GoalSheet.cycle_id)
        .filter(Cycle.phase.in_(check_in_phases), User.role == "employee")
        .group_by(User.department, Cycle.year, Cycle.phase)
        .order_by(User.department, Cycle.year, Cycle.phase)
        .all()
    )

    return [
        {
            "department": r.department or "Unknown",
            "quarter": f"{r.year} {r.phase.value.upper()}",
            "year": r.year,
            "phase": r.phase.value,
            "total": r.total,
            "approved": int(r.approved or 0),
            "completion_pct": round((int(r.approved or 0) / r.total) * 100, 1) if r.total else 0,
        }
        for r in rows
    ]


# ── 3. Goal Distribution ──────────────────────────────────────────────────────

def get_goal_distribution(db: Session, cycle_id: int = None):
    """Breakdown of goals by thrust area, UoM type, and status."""

    base = db.query(Goal).join(GoalSheet, GoalSheet.id == Goal.goal_sheet_id)
    if cycle_id:
        base = base.filter(GoalSheet.cycle_id == cycle_id)

    # By thrust area
    by_thrust = (
        base.with_entities(
            ThrustArea.name,
            func.count(Goal.id).label("count"),
            func.avg(Goal.weightage).label("avg_weightage"),
        )
        .join(ThrustArea, ThrustArea.id == Goal.thrust_area_id)
        .group_by(ThrustArea.name)
        .order_by(func.count(Goal.id).desc())
        .all()
    )

    # By UoM type
    by_uom = (
        base.with_entities(
            Goal.uom_type,
            func.count(Goal.id).label("count"),
        )
        .group_by(Goal.uom_type)
        .all()
    )

    # By actual status (from quarterly actuals)
    by_status = (
        db.query(
            QuarterlyActual.status,
            func.count(QuarterlyActual.id).label("count"),
        )
        .group_by(QuarterlyActual.status)
        .all()
    )
    if cycle_id:
        by_status = (
            db.query(
                QuarterlyActual.status,
                func.count(QuarterlyActual.id).label("count"),
            )
            .filter(QuarterlyActual.cycle_id == cycle_id)
            .group_by(QuarterlyActual.status)
            .all()
        )

    return {
        "by_thrust_area": [
            {
                "name": r.name,
                "count": r.count,
                "avg_weightage": round(float(r.avg_weightage), 1) if r.avg_weightage else 0,
            }
            for r in by_thrust
        ],
        "by_uom_type": [
            {"uom_type": r.uom_type.value, "count": r.count}
            for r in by_uom
        ],
        "by_status": [
            {"status": r.status.value, "count": r.count}
            for r in by_status
        ],
    }


# ── 4. Manager Effectiveness ─────────────────────────────────────────────────

def get_manager_effectiveness(db: Session, cycle_id: int = None):
    """Check-in completion rate and approval speed per L1 manager."""
    managers = db.query(User).filter(User.role == "manager", User.is_active == True).all()
    results = []

    for mgr in managers:
        direct_ids = [u.id for u in db.query(User).filter(User.manager_id == mgr.id).all()]
        if not direct_ids:
            continue

        sheet_q = db.query(GoalSheet).filter(GoalSheet.employee_id.in_(direct_ids))
        if cycle_id:
            sheet_q = sheet_q.filter(GoalSheet.cycle_id == cycle_id)
        sheets = sheet_q.all()

        if not sheets:
            continue

        total = len(sheets)
        approved = sum(1 for s in sheets if s.status == SheetStatus.APPROVED)
        returned = sum(1 for s in sheets if s.status == SheetStatus.RETURNED)

        # Avg days to approve (submitted_at → approved_at)
        approval_times = []
        for s in sheets:
            if s.submitted_at and s.approved_at:
                delta = (s.approved_at - s.submitted_at).total_seconds() / 86400
                approval_times.append(delta)

        # Check-in comments logged
        comment_q = db.query(CheckinComment).filter(CheckinComment.manager_id == mgr.id)
        if cycle_id:
            comment_q = comment_q.filter(CheckinComment.cycle_id == cycle_id)
        comments_count = comment_q.count()

        results.append({
            "manager_id": mgr.id,
            "manager_name": mgr.name,
            "department": mgr.department,
            "team_size": len(direct_ids),
            "sheets_total": total,
            "sheets_approved": approved,
            "sheets_returned": returned,
            "approval_rate_pct": round((approved / total) * 100, 1) if total else 0,
            "avg_approval_days": round(sum(approval_times) / len(approval_times), 1) if approval_times else None,
            "checkin_comments_logged": comments_count,
        })

    return sorted(results, key=lambda x: x["approval_rate_pct"], reverse=True)


# ── 5. Org Overview (admin home KPIs) ────────────────────────────────────────

def get_org_overview(db: Session, cycle_id: int):
    total_employees = db.query(User).filter(User.role == "employee", User.is_active == True).count()
    total_sheets = db.query(GoalSheet).filter(GoalSheet.cycle_id == cycle_id).count()
    approved = db.query(GoalSheet).filter(GoalSheet.cycle_id == cycle_id, GoalSheet.status == SheetStatus.APPROVED).count()
    submitted = db.query(GoalSheet).filter(GoalSheet.cycle_id == cycle_id, GoalSheet.status == SheetStatus.SUBMITTED).count()
    not_started = total_employees - total_sheets

    avg_score = db.query(func.avg(QuarterlyActual.progress_score)).filter(
        QuarterlyActual.cycle_id == cycle_id,
        QuarterlyActual.progress_score.isnot(None),
    ).scalar()

    from ..models.escalation import EscalationEvent
    open_escalations = db.query(func.count(EscalationEvent.id)).filter(
        EscalationEvent.is_resolved == False
    ).scalar()

    return {
        "cycle_id": cycle_id,
        "total_employees": total_employees,
        "goal_setting": {
            "approved": approved,
            "submitted": submitted,
            "not_started": not_started,
            "completion_rate_pct": round((approved / total_employees) * 100, 1) if total_employees else 0,
        },
        "avg_progress_score": round(float(avg_score), 1) if avg_score else None,
        "open_escalations": open_escalations or 0,
    }
