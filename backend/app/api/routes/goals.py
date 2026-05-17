from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.security import get_current_user, require_role
from ...models.goal import ThrustArea, GoalSheet, Goal, QuarterlyActual, Cycle
from ...schemas.goal import (
    GoalCreate, GoalUpdate, GoalRead, GoalSheetRead,
    QuarterlyActualUpdate, QuarterlyActualRead,
    ManagerApprovalRequest, CheckinCommentCreate, CheckinCommentRead,
    ThrustAreaRead, CycleRead, SharedGoalPush, SharedGoalWeightageUpdate,
)
from ...services import goal_service
from ...models.goal import CheckinComment, SharedGoal, SheetStatus
from ...models.user import User

router = APIRouter(prefix="/goals", tags=["goals"])


# ── Reference Data ────────────────────────────────────────────────────────────

@router.get("/thrust-areas", response_model=List[ThrustAreaRead])
def list_thrust_areas(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(ThrustArea).filter(ThrustArea.is_active == True).all()


@router.get("/cycles", response_model=List[CycleRead])
def list_cycles(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Cycle).order_by(Cycle.year, Cycle.phase).all()


@router.get("/cycles/active", response_model=CycleRead)
def active_cycle(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return goal_service.get_active_cycle(db)


# ── My Goal Sheet ─────────────────────────────────────────────────────────────

@router.post("/sheets", response_model=GoalSheetRead)
def create_or_get_sheet(
    cycle_id: int = Query(..., description="Cycle ID to create sheet for"),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.get_or_create_sheet(current_user, cycle_id, db)


@router.get("/sheets/me", response_model=Optional[GoalSheetRead])
def my_sheet(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.get_my_sheet(current_user, cycle_id, db)


@router.get("/sheets/{sheet_id}", response_model=GoalSheetRead)
def get_sheet(sheet_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    sheet = db.query(GoalSheet).filter(GoalSheet.id == sheet_id).first()
    if not sheet:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sheet not found")
    # Employee can only see their own; managers and admins can see any
    if current_user.role == "employee" and sheet.employee_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not your sheet")
    return sheet


# ── Goal CRUD ─────────────────────────────────────────────────────────────────

@router.post("/sheets/{sheet_id}/goals", response_model=GoalRead)
def add_goal(
    sheet_id: int,
    body: GoalCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.add_goal(sheet_id, body, current_user, db)


@router.put("/sheets/{sheet_id}/goals/{goal_id}", response_model=GoalRead)
def update_goal(
    sheet_id: int,
    goal_id: int,
    body: GoalUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.update_goal(sheet_id, goal_id, body, current_user, db)


@router.delete("/sheets/{sheet_id}/goals/{goal_id}", status_code=204)
def delete_goal(
    sheet_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    goal_service.delete_goal(sheet_id, goal_id, current_user, db)


# ── Submit ────────────────────────────────────────────────────────────────────

@router.post("/sheets/{sheet_id}/submit", response_model=GoalSheetRead)
def submit_sheet(
    sheet_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.submit_sheet(sheet_id, current_user, db)


# ── Manager Actions ───────────────────────────────────────────────────────────

@router.get("/manager/team-sheets", response_model=List[GoalSheetRead])
def team_sheets(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    """All goal sheets for the manager's direct reports in a given cycle."""
    from sqlalchemy.orm import joinedload
    direct_report_ids = [u.id for u in db.query(User).filter(User.manager_id == current_user.id).all()]
    return (
        db.query(GoalSheet)
        .options(joinedload(GoalSheet.employee), joinedload(GoalSheet.goals))
        .filter(
            GoalSheet.employee_id.in_(direct_report_ids),
            GoalSheet.cycle_id == cycle_id,
        )
        .all()
    )


@router.post("/sheets/{sheet_id}/manager-action", response_model=GoalSheetRead)
def manager_action(
    sheet_id: int,
    body: ManagerApprovalRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    return goal_service.manager_action(
        sheet_id, body.action, current_user, db,
        return_reason=body.return_reason,
        goal_edits=body.goal_edits,
    )


@router.post("/sheets/{sheet_id}/checkin-comment", response_model=CheckinCommentRead)
def add_checkin_comment(
    sheet_id: int,
    body: CheckinCommentCreate,
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    sheet = db.query(GoalSheet).filter(GoalSheet.id == sheet_id).first()
    if not sheet:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sheet not found")

    comment = CheckinComment(
        goal_sheet_id=sheet_id,
        cycle_id=cycle_id,
        manager_id=current_user.id,
        comment=body.comment,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


# ── Quarterly Actuals ─────────────────────────────────────────────────────────

@router.put("/goals/{goal_id}/actuals", response_model=QuarterlyActualRead)
def update_actual(
    goal_id: int,
    body: QuarterlyActualUpdate,
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    return goal_service.update_actual(
        goal_id, cycle_id,
        body.actual_numeric, body.actual_date, body.status,
        current_user, db,
    )


@router.get("/goals/{goal_id}/actuals", response_model=List[QuarterlyActualRead])
def get_actuals(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return db.query(QuarterlyActual).filter(QuarterlyActual.goal_id == goal_id).all()


# ── Admin: Unlock ─────────────────────────────────────────────────────────────

@router.post("/goals/{goal_id}/unlock", response_model=GoalRead)
def unlock_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin")),
):
    return goal_service.admin_unlock_goal(goal_id, current_user, db)


# ── Shared Goals ──────────────────────────────────────────────────────────────

@router.post("/shared/push", status_code=201)
def push_shared_goal(
    body: SharedGoalPush,
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_role("manager", "admin")),
):
    """Push a departmental KPI to multiple employees as a shared goal."""
    from ...models.goal import ThrustArea as TA
    thrust = db.query(TA).filter(TA.id == body.thrust_area_id).first()
    if not thrust:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Thrust area not found")

    created = []
    skipped = []
    for emp_id in body.recipient_ids:
        employee = db.query(User).filter(User.id == emp_id).first()
        if not employee:
            skipped.append({"employee_id": emp_id, "reason": "Employee not found"})
            continue

        sheet = goal_service.get_or_create_sheet(employee, cycle_id, db)

        if len(sheet.goals) >= goal_service.MAX_GOALS:
            skipped.append({"employee_id": emp_id, "reason": f"At max goal capacity ({goal_service.MAX_GOALS})"})
            continue

        # BRD enforcement: total weightage must not exceed 100%
        current_total = sum(g.weightage for g in sheet.goals)
        push_weight = body.default_weightage or 0
        if current_total + push_weight > 100.0:
            skipped.append({
                "employee_id": emp_id,
                "reason": f"Would exceed 100% weightage (current: {current_total}%, push: {push_weight}%)"
            })
            continue

        goal = Goal(
            goal_sheet_id=sheet.id,
            thrust_area_id=body.thrust_area_id,
            title=body.title,
            description=body.description,
            uom_type=body.uom_type,
            target_numeric=body.target_numeric,
            target_date=body.target_date,
            weightage=body.default_weightage,
            is_shared=True,
            primary_owner_id=current_user.id,
        )
        db.add(goal)
        db.flush()

        db.add(SharedGoal(
            goal_id=goal.id,
            recipient_employee_id=emp_id,
            weightage=body.default_weightage,
        ))
        created.append(emp_id)

    db.commit()
    return {"pushed_to": created, "count": len(created), "skipped": skipped}


@router.put("/shared/{goal_id}/weightage", response_model=GoalRead)
def update_shared_weightage(
    goal_id: int,
    body: SharedGoalWeightageUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("employee")),
):
    """Recipient employee can only adjust their weightage on a shared goal."""
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.is_shared == True).first()
    if not goal:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shared goal not found")

    sheet = goal.goal_sheet
    if sheet.employee_id != current_user.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not your goal sheet")

    goal_service._assert_editable(sheet)

    projected = goal_service._validate_weightage(sheet.goals, exclude_id=goal_id, new_weightage=body.weightage)
    if projected > goal_service.REQUIRED_TOTAL:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Total would be {projected}%. Max is 100%.")

    goal.weightage = body.weightage
    db.commit()
    db.refresh(goal)
    return goal
