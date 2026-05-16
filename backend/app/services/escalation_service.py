"""
Escalation engine — checks three trigger conditions from the BRD:
  1. employee_not_submitted  — employee hasn't submitted goals within N days of cycle open
  2. manager_not_approved    — manager hasn't approved within N days of submission
  3. checkin_not_completed   — employee hasn't updated actuals within active check-in window

Runs on a schedule via APScheduler. Each run:
  - Queries the DB for violations
  - Creates/updates EscalationEvent rows
  - Fires notifications (email handled by notification_service)
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..models.goal import GoalSheet, SheetStatus, Cycle, CyclePhase, QuarterlyActual
from ..models.user import User
from ..models.escalation import EscalationRule, EscalationEvent


CHECK_IN_PHASES = {CyclePhase.Q1, CyclePhase.Q2, CyclePhase.Q3, CyclePhase.Q4}


def _get_rule(db: Session, trigger_type: str) -> EscalationRule | None:
    return db.query(EscalationRule).filter(
        EscalationRule.trigger_type == trigger_type,
        EscalationRule.is_active == True,
    ).first()


def _already_escalated(db: Session, rule_id: int, employee_id: int, cycle_id: int) -> bool:
    return db.query(EscalationEvent).filter(
        EscalationEvent.rule_id == rule_id,
        EscalationEvent.employee_id == employee_id,
        EscalationEvent.cycle_id == cycle_id,
        EscalationEvent.is_resolved == False,
    ).first() is not None


def _create_event(db: Session, rule: EscalationRule, employee_id: int, cycle_id: int, note: str):
    event = EscalationEvent(
        rule_id=rule.id,
        employee_id=employee_id,
        cycle_id=cycle_id,
        escalation_level=1,
        note=note,
    )
    db.add(event)
    db.commit()
    return event


def _resolve_event(db: Session, rule_id: int, employee_id: int, cycle_id: int):
    """Mark resolved when the condition is no longer true."""
    db.query(EscalationEvent).filter(
        EscalationEvent.rule_id == rule_id,
        EscalationEvent.employee_id == employee_id,
        EscalationEvent.cycle_id == cycle_id,
        EscalationEvent.is_resolved == False,
    ).update({
        "is_resolved": True,
        "resolved_at": datetime.now(timezone.utc),
    })
    db.commit()


# ── Check 1: Employee hasn't submitted ───────────────────────────────────────

def check_employee_not_submitted(db: Session):
    rule = _get_rule(db, "employee_not_submitted")
    if not rule:
        return

    goal_setting_cycle = db.query(Cycle).filter(
        Cycle.is_active == True,
        Cycle.phase == CyclePhase.GOAL_SETTING,
    ).first()
    if not goal_setting_cycle:
        return

    deadline = datetime.combine(goal_setting_cycle.window_open, datetime.min.time()).replace(tzinfo=timezone.utc)
    threshold = deadline + timedelta(days=rule.threshold_days)
    now = datetime.now(timezone.utc)

    if now < threshold:
        return  # not overdue yet

    employees = db.query(User).filter(User.role == "employee", User.is_active == True).all()

    for emp in employees:
        sheet = db.query(GoalSheet).filter(
            GoalSheet.employee_id == emp.id,
            GoalSheet.cycle_id == goal_setting_cycle.id,
        ).first()

        not_submitted = not sheet or sheet.status == SheetStatus.DRAFT
        if not_submitted:
            if not _already_escalated(db, rule.id, emp.id, goal_setting_cycle.id):
                note = f"Employee {emp.name} has not submitted goals {rule.threshold_days}+ days after cycle opened."
                event = _create_event(db, rule, emp.id, goal_setting_cycle.id, note)
                _notify(emp, rule, event, db)
        else:
            # Condition resolved — clear any open escalation
            _resolve_event(db, rule.id, emp.id, goal_setting_cycle.id)


# ── Check 2: Manager hasn't approved ────────────────────────────────────────

def check_manager_not_approved(db: Session):
    rule = _get_rule(db, "manager_not_approved")
    if not rule:
        return

    threshold_delta = timedelta(days=rule.threshold_days)
    now = datetime.now(timezone.utc)

    pending_sheets = db.query(GoalSheet).filter(
        GoalSheet.status == SheetStatus.SUBMITTED,
        GoalSheet.submitted_at.isnot(None),
    ).all()

    for sheet in pending_sheets:
        submitted_at = sheet.submitted_at
        if submitted_at.tzinfo is None:
            submitted_at = submitted_at.replace(tzinfo=timezone.utc)

        overdue = (now - submitted_at) > threshold_delta
        if overdue:
            if not _already_escalated(db, rule.id, sheet.employee_id, sheet.cycle_id):
                emp = db.query(User).filter(User.id == sheet.employee_id).first()
                note = f"Manager has not approved {emp.name}'s goals {rule.threshold_days}+ days after submission."
                event = _create_event(db, rule, sheet.employee_id, sheet.cycle_id, note)
                _notify(emp, rule, event, db)
        else:
            _resolve_event(db, rule.id, sheet.employee_id, sheet.cycle_id)


# ── Check 3: Check-in not completed ─────────────────────────────────────────

def check_checkin_not_completed(db: Session):
    rule = _get_rule(db, "checkin_not_completed")
    if not rule:
        return

    active_cycle = db.query(Cycle).filter(
        Cycle.is_active == True,
        Cycle.phase.in_(CHECK_IN_PHASES),
    ).first()
    if not active_cycle:
        return

    deadline = datetime.combine(active_cycle.window_close, datetime.min.time()).replace(tzinfo=timezone.utc)
    threshold = deadline - timedelta(days=rule.threshold_days)
    now = datetime.now(timezone.utc)

    if now < threshold:
        return  # not overdue yet

    approved_sheets = db.query(GoalSheet).filter(
        GoalSheet.status == SheetStatus.APPROVED,
    ).all()

    for sheet in approved_sheets:
        # Check if employee has logged actuals for ALL goals this quarter
        goals_with_actuals = set(
            a.goal_id for a in db.query(QuarterlyActual).filter(
                QuarterlyActual.cycle_id == active_cycle.id,
                QuarterlyActual.goal_id.in_([g.id for g in sheet.goals]),
            ).all()
        )
        all_goals_updated = all(g.id in goals_with_actuals for g in sheet.goals)

        if not all_goals_updated:
            if not _already_escalated(db, rule.id, sheet.employee_id, active_cycle.id):
                emp = db.query(User).filter(User.id == sheet.employee_id).first()
                note = f"Employee {emp.name} has not completed check-in for {active_cycle.phase.value} with {rule.threshold_days} days remaining."
                event = _create_event(db, rule, sheet.employee_id, active_cycle.id, note)
                _notify(emp, rule, event, db)
        else:
            _resolve_event(db, rule.id, sheet.employee_id, active_cycle.id)


def _notify(employee: User, rule: EscalationRule, event: EscalationEvent, db: Session):
    """Delegate to notification service — imported here to avoid circular deps."""
    try:
        from .notification_service import send_escalation_notification
        send_escalation_notification(employee, rule, event, db)
    except Exception:
        pass  # never let notification failure break the escalation engine


# ── Main runner — called by scheduler ────────────────────────────────────────

def run_all_checks():
    db: Session = SessionLocal()
    try:
        check_employee_not_submitted(db)
        check_manager_not_approved(db)
        check_checkin_not_completed(db)
    except Exception as e:
        print(f"[Escalation] Error during check: {e}")
    finally:
        db.close()
