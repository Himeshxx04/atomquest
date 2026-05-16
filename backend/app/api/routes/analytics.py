from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ...core.database import get_db
from ...core.security import require_role
from ...services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Managers and admins can see analytics
analytics_access = Depends(require_role("manager", "admin"))


@router.get("/overview")
def org_overview(
    cycle_id: int = Query(...),
    db: Session = Depends(get_db),
    _=analytics_access,
):
    """Top-level KPIs: completion rate, avg score, open escalations."""
    return analytics_service.get_org_overview(db, cycle_id)


@router.get("/qoq-trend")
def qoq_trend(
    department: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=analytics_access,
):
    """Quarter-on-Quarter average progress score trend."""
    return analytics_service.get_qoq_trend(db, department, employee_id)


@router.get("/heatmap")
def heatmap(
    db: Session = Depends(get_db),
    _=analytics_access,
):
    """Completion rate matrix: department × quarter."""
    return analytics_service.get_heatmap(db)


@router.get("/goal-distribution")
def goal_distribution(
    cycle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=analytics_access,
):
    """Goal breakdown by thrust area, UoM type, and achievement status."""
    return analytics_service.get_goal_distribution(db, cycle_id)


@router.get("/manager-effectiveness")
def manager_effectiveness(
    cycle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Per-manager: approval rate, avg approval days, check-in comments."""
    return analytics_service.get_manager_effectiveness(db, cycle_id)
