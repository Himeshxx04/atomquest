from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..models.goal import Goal, GoalSheet, SharedGoal, QuarterlyActual, Cycle, ThrustArea, SheetStatus, UoMType, GoalStatus
from ..models.user import User
from ..models.audit import AuditLog
from ..schemas.goal import GoalCreate, GoalUpdate, GoalInlineEdit


MAX_GOALS = 8
MIN_WEIGHTAGE = 10.0
REQUIRED_TOTAL = 100.0


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_sheet_or_404(sheet_id: int, db: Session) -> GoalSheet:
    sheet = db.query(GoalSheet).filter(GoalSheet.id == sheet_id).first()
    if not sheet:
        raise HTTPException(status_code=404, detail="Goal sheet not found")
    return sheet


def _assert_employee_owns(sheet: GoalSheet, user: User):
    if sheet.employee_id != user.id:
        raise HTTPException(status_code=403, detail="Not your goal sheet")


def _assert_editable(sheet: GoalSheet):
    if sheet.status not in (SheetStatus.DRAFT, SheetStatus.RETURNED):
        raise HTTPException(
            status_code=400,
            detail=f"Goal sheet is {sheet.status.value} — edits not allowed. Only DRAFT or RETURNED sheets can be edited."
        )


def _validate_weightage(goals: List[Goal], exclude_id: Optional[int] = None, new_weightage: float = 0.0) -> float:
    """Returns the projected total weightage after the proposed change."""
    total = sum(
        (new_weightage if g.id == exclude_id else g.weightage)
        for g in goals
        if g.id != exclude_id or exclude_id is None
    )
    if exclude_id is None:
        total += new_weightage
    return total


def compute_progress_score(goal: Goal, actual_numeric: Optional[float], actual_date) -> Optional[float]:
    """Compute progress score based on UoM type per BRD formula."""
    try:
        if goal.uom_type == UoMType.MIN:
            if goal.target_numeric and goal.target_numeric > 0:
                return round(min((actual_numeric / goal.target_numeric) * 100, 100), 2)
        elif goal.uom_type == UoMType.MAX:
            if actual_numeric is not None and actual_numeric == 0:
                return 100.0  # Zero actual on a lower-is-better goal = perfect score
            if actual_numeric and actual_numeric > 0:
                return round(min((goal.target_numeric / actual_numeric) * 100, 100), 2)
        elif goal.uom_type == UoMType.TIMELINE:
            if actual_date and goal.target_date:
                return 100.0 if actual_date <= goal.target_date else 0.0
        elif goal.uom_type == UoMType.ZERO:
            return 100.0 if actual_numeric == 0 else 0.0
    except (TypeError, ZeroDivisionError):
        pass
    return None


def _log_audit(db: Session, entity_type: str, entity_id: int, changed_by: int,
               action: str, field: str = None, old=None, new=None, note: str = None):
    db.add(AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        changed_by=changed_by,
        action=action,
        field_name=field,
        old_value=str(old) if old is not None else None,
        new_value=str(new) if new is not None else None,
        note=note,
    ))


# ── Goal Sheet ────────────────────────────────────────────────────────────────

def get_or_create_sheet(employee: User, cycle_id: int, db: Session) -> GoalSheet:
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")

    sheet = db.query(GoalSheet).filter(
        GoalSheet.employee_id == employee.id,
        GoalSheet.cycle_id == cycle_id,
    ).first()

    if not sheet:
        sheet = GoalSheet(employee_id=employee.id, cycle_id=cycle_id, status=SheetStatus.DRAFT)
        db.add(sheet)
        db.commit()
        db.refresh(sheet)

    return sheet


def get_my_sheet(employee: User, cycle_id: int, db: Session) -> Optional[GoalSheet]:
    return db.query(GoalSheet).filter(
        GoalSheet.employee_id == employee.id,
        GoalSheet.cycle_id == cycle_id,
    ).first()


def get_active_cycle(db: Session) -> Cycle:
    cycle = db.query(Cycle).filter(Cycle.is_active == True).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="No active cycle found. Contact Admin.")
    return cycle


# ── Goal CRUD ─────────────────────────────────────────────────────────────────

def add_goal(sheet_id: int, data: GoalCreate, employee: User, db: Session) -> Goal:
    sheet = _get_sheet_or_404(sheet_id, db)
    _assert_employee_owns(sheet, employee)
    _assert_editable(sheet)

    # BRD: max 8 goals per employee
    if len(sheet.goals) >= MAX_GOALS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_GOALS} goals allowed per employee. You already have {len(sheet.goals)}."
        )

    # BRD: projected total must not exceed 100%
    projected = _validate_weightage(sheet.goals, new_weightage=data.weightage)
    if projected > REQUIRED_TOTAL:
        raise HTTPException(
            status_code=400,
            detail=f"Adding this goal would bring total weightage to {projected}%. Maximum is 100%."
        )

    thrust = db.query(ThrustArea).filter(ThrustArea.id == data.thrust_area_id, ThrustArea.is_active == True).first()
    if not thrust:
        raise HTTPException(status_code=404, detail="Thrust area not found")

    goal = Goal(
        goal_sheet_id=sheet_id,
        thrust_area_id=data.thrust_area_id,
        title=data.title,
        description=data.description,
        uom_type=data.uom_type,
        target_numeric=data.target_numeric,
        target_date=data.target_date,
        weightage=data.weightage,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    _log_audit(db, "goal", goal.id, employee.id, "created", note=f"Goal '{goal.title}' added to sheet {sheet_id}")
    db.commit()
    return goal


def update_goal(sheet_id: int, goal_id: int, data: GoalUpdate, employee: User, db: Session) -> Goal:
    sheet = _get_sheet_or_404(sheet_id, db)
    _assert_employee_owns(sheet, employee)
    _assert_editable(sheet)

    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.goal_sheet_id == sheet_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found in this sheet")

    if goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is locked. Contact Admin to unlock.")

    # Check shared goal — employees can only edit weightage on shared goals
    if goal.is_shared and goal.primary_owner_id != employee.id:
        allowed = {"weightage"}
        attempted = {k for k, v in data.model_dump(exclude_none=True).items()}
        if not attempted.issubset(allowed):
            raise HTTPException(status_code=403, detail="Shared goals: you can only change your weightage.")

    changes = data.model_dump(exclude_none=True)

    if "weightage" in changes:
        new_w = changes["weightage"]
        projected = _validate_weightage(sheet.goals, exclude_id=goal_id, new_weightage=new_w)
        if projected > REQUIRED_TOTAL:
            raise HTTPException(
                status_code=400,
                detail=f"This change would bring total weightage to {projected}%. Maximum is 100%."
            )

    for field, new_val in changes.items():
        old_val = getattr(goal, field)
        if old_val != new_val:
            _log_audit(db, "goal", goal.id, employee.id, "updated", field=field, old=old_val, new=new_val)
            setattr(goal, field, new_val)

    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(sheet_id: int, goal_id: int, employee: User, db: Session):
    sheet = _get_sheet_or_404(sheet_id, db)
    _assert_employee_owns(sheet, employee)
    _assert_editable(sheet)

    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.goal_sheet_id == sheet_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is locked. Contact Admin to unlock.")

    _log_audit(db, "goal", goal.id, employee.id, "deleted", note=f"Goal '{goal.title}' deleted")
    db.delete(goal)
    db.commit()


def submit_sheet(sheet_id: int, employee: User, db: Session) -> GoalSheet:
    sheet = _get_sheet_or_404(sheet_id, db)
    _assert_employee_owns(sheet, employee)
    _assert_editable(sheet)

    if not sheet.goals:
        raise HTTPException(status_code=400, detail="Cannot submit an empty goal sheet. Add at least one goal.")

    # BRD: total weightage must equal exactly 100%
    total = sum(g.weightage for g in sheet.goals)
    if abs(total - REQUIRED_TOTAL) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Total weightage is {total:.1f}%. It must equal exactly 100% before submitting."
        )

    sheet.status = SheetStatus.SUBMITTED
    sheet.submitted_at = datetime.now(timezone.utc)
    _log_audit(db, "goal_sheet", sheet.id, employee.id, "submitted")
    db.commit()
    db.refresh(sheet)

    # Notify manager
    try:
        from .notification_service import notify_sheet_submitted
        if employee.manager:
            cycle_label = f"{sheet.cycle.year} {sheet.cycle.phase.value}"
            notify_sheet_submitted(employee, employee.manager, cycle_label)
    except Exception as e:
        print(f"[Notify] Failed to send submit email: {e}")

    return sheet


# ── Manager Actions ───────────────────────────────────────────────────────────

def manager_action(sheet_id: int, action: str, manager: User, db: Session,
                   return_reason: str = None, goal_edits: list = None) -> GoalSheet:
    sheet = _get_sheet_or_404(sheet_id, db)

    if sheet.status != SheetStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Sheet must be in SUBMITTED status for manager action.")

    # Verify manager has authority over this employee
    employee = db.query(User).filter(User.id == sheet.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found for this sheet.")
    if employee.manager_id != manager.id and manager.role != "admin":
        raise HTTPException(status_code=403, detail="You are not this employee's manager.")

    if action == "approve":
        # Apply any inline edits before locking
        if goal_edits:
            for edit in goal_edits:
                goal = db.query(Goal).filter(Goal.id == edit.goal_id, Goal.goal_sheet_id == sheet_id).first()
                if goal:
                    if edit.weightage is not None:
                        _log_audit(db, "goal", goal.id, manager.id, "updated", "weightage", goal.weightage, edit.weightage, "Manager inline edit")
                        goal.weightage = edit.weightage
                    if edit.target_numeric is not None:
                        _log_audit(db, "goal", goal.id, manager.id, "updated", "target_numeric", goal.target_numeric, edit.target_numeric, "Manager inline edit")
                        goal.target_numeric = edit.target_numeric
                    if edit.target_date is not None:
                        _log_audit(db, "goal", goal.id, manager.id, "updated", "target_date", goal.target_date, edit.target_date, "Manager inline edit")
                        goal.target_date = edit.target_date

        # Re-validate total weightage after edits
        total = sum(g.weightage for g in sheet.goals)
        if abs(total - REQUIRED_TOTAL) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"After your edits, total weightage is {total:.1f}%. Must be exactly 100% to approve."
            )

        # Lock all goals
        for goal in sheet.goals:
            goal.is_locked = True
            _log_audit(db, "goal", goal.id, manager.id, "locked", note="Locked on manager approval")

        sheet.status = SheetStatus.APPROVED
        sheet.approved_at = datetime.now(timezone.utc)
        sheet.approved_by = manager.id
        sheet.return_reason = None
        _log_audit(db, "goal_sheet", sheet.id, manager.id, "approved")
        db.commit()
        db.refresh(sheet)

        try:
            from .notification_service import notify_sheet_approved
            cycle_label = f"{sheet.cycle.year} {sheet.cycle.phase.value}"
            notify_sheet_approved(employee, cycle_label)
        except Exception as e:
            print(f"[Notify] Failed to send approve email: {e}")

        return sheet

    elif action == "return":
        if not return_reason:
            raise HTTPException(status_code=400, detail="return_reason is required when returning a sheet.")
        sheet.status = SheetStatus.RETURNED
        sheet.return_reason = return_reason
        # Unlock all goals so the employee can re-edit and re-submit
        for goal in sheet.goals:
            goal.is_locked = False
        _log_audit(db, "goal_sheet", sheet.id, manager.id, "returned", note=return_reason)
        db.commit()
        db.refresh(sheet)

        try:
            from .notification_service import notify_sheet_returned
            cycle_label = f"{sheet.cycle.year} {sheet.cycle.phase.value}"
            notify_sheet_returned(employee, return_reason, cycle_label)
        except Exception as e:
            print(f"[Notify] Failed to send return email: {e}")

        return sheet

    db.commit()
    db.refresh(sheet)
    return sheet


# ── Admin: Unlock ─────────────────────────────────────────────────────────────

def admin_unlock_goal(goal_id: int, admin: User, db: Session) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if not goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is not locked")

    goal.is_locked = False
    _log_audit(db, "goal", goal.id, admin.id, "unlocked", note="Admin unlock")
    db.commit()
    db.refresh(goal)
    return goal


# ── Quarterly Actuals ─────────────────────────────────────────────────────────

def update_actual(goal_id: int, cycle_id: int, actual_numeric, actual_date,
                  goal_status: GoalStatus, employee: User, db: Session) -> QuarterlyActual:
    goal = db.query(Goal).filter(Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    sheet = goal.goal_sheet
    if sheet.employee_id != employee.id:
        raise HTTPException(status_code=403, detail="Not your goal")
    if sheet.status != SheetStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Goals must be approved before logging actuals.")

    # BRD: actuals can only be logged during an active check-in cycle window
    from ..models.goal import CyclePhase
    checkin_phases = {CyclePhase.Q1, CyclePhase.Q2, CyclePhase.Q3, CyclePhase.Q4}
    cycle = db.query(Cycle).filter(Cycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle not found")
    if cycle.phase not in checkin_phases:
        raise HTTPException(
            status_code=400,
            detail=f"Actuals can only be logged during a check-in cycle (Q1–Q4). Current cycle phase is '{cycle.phase.value}'."
        )
    today = datetime.now(timezone.utc).date()
    if cycle.window_open and today < cycle.window_open:
        raise HTTPException(
            status_code=400,
            detail=f"The {cycle.phase.value.upper()} check-in window opens on {cycle.window_open}. You cannot log actuals yet."
        )
    if cycle.window_close and today > cycle.window_close:
        raise HTTPException(
            status_code=400,
            detail=f"The {cycle.phase.value.upper()} check-in window closed on {cycle.window_close}. Contact Admin if you need to log late actuals."
        )

    score = compute_progress_score(goal, actual_numeric, actual_date)

    actual = db.query(QuarterlyActual).filter(
        QuarterlyActual.goal_id == goal_id,
        QuarterlyActual.cycle_id == cycle_id,
    ).first()

    if actual:
        actual.actual_numeric = actual_numeric
        actual.actual_date = actual_date
        actual.status = goal_status
        actual.progress_score = score
    else:
        actual = QuarterlyActual(
            goal_id=goal_id,
            cycle_id=cycle_id,
            actual_numeric=actual_numeric,
            actual_date=actual_date,
            status=goal_status,
            progress_score=score,
        )
        db.add(actual)

    # If this is a shared goal, sync the achievement to all linked copies
    if goal.is_shared:
        linked = db.query(SharedGoal).filter(SharedGoal.goal_id == goal_id).all()
        for link in linked:
            linked_sheet = db.query(GoalSheet).filter(
                GoalSheet.employee_id == link.recipient_employee_id,
                GoalSheet.cycle_id == sheet.cycle_id,
            ).first()
            if linked_sheet:
                linked_goals = db.query(Goal).filter(
                    Goal.goal_sheet_id == linked_sheet.id,
                    Goal.primary_owner_id == goal.goal_sheet.employee_id,
                ).all()
                for lg in linked_goals:
                    lg_actual = db.query(QuarterlyActual).filter(
                        QuarterlyActual.goal_id == lg.id,
                        QuarterlyActual.cycle_id == cycle_id,
                    ).first()
                    if lg_actual:
                        lg_actual.actual_numeric = actual_numeric
                        lg_actual.actual_date = actual_date
                        lg_actual.status = goal_status
                        lg_actual.progress_score = score
                    else:
                        db.add(QuarterlyActual(
                            goal_id=lg.id, cycle_id=cycle_id,
                            actual_numeric=actual_numeric, actual_date=actual_date,
                            status=goal_status, progress_score=score,
                        ))

    db.commit()
    db.refresh(actual)
    return actual
