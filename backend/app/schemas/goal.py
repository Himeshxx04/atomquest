from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime, date
from ..models.goal import UoMType, GoalStatus, SheetStatus, CyclePhase


class ThrustAreaRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class CycleRead(BaseModel):
    id: int
    year: int
    phase: CyclePhase
    window_open: date
    window_close: date
    is_active: bool

    class Config:
        from_attributes = True


# ── Goal ────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    thrust_area_id: int
    title: str
    description: Optional[str] = None
    uom_type: UoMType
    target_numeric: Optional[float] = None
    target_date: Optional[date] = None
    weightage: float

    @field_validator("weightage")
    @classmethod
    def check_min_weightage(cls, v):
        if v < 10:
            raise ValueError("Minimum weightage per goal is 10%")
        return v

    @model_validator(mode="after")
    def check_target(self):
        if self.uom_type == UoMType.TIMELINE and not self.target_date:
            raise ValueError("target_date is required for Timeline UoM")
        if self.uom_type in (UoMType.MIN, UoMType.MAX) and self.target_numeric is None:
            raise ValueError("target_numeric is required for Numeric/Percentage UoM")
        if self.uom_type == UoMType.ZERO and self.target_numeric is None:
            self.target_numeric = 0.0
        return self


class GoalUpdate(BaseModel):
    thrust_area_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    target_numeric: Optional[float] = None
    target_date: Optional[date] = None
    weightage: Optional[float] = None

    @field_validator("weightage")
    @classmethod
    def check_min_weightage(cls, v):
        if v is not None and v < 10:
            raise ValueError("Minimum weightage per goal is 10%")
        return v


class GoalRead(BaseModel):
    id: int
    goal_sheet_id: int
    thrust_area_id: int
    title: str
    description: Optional[str] = None
    uom_type: UoMType
    target_numeric: Optional[float] = None
    target_date: Optional[date] = None
    weightage: float
    is_locked: bool
    is_shared: bool
    primary_owner_id: Optional[int] = None

    class Config:
        from_attributes = True


# ── Quarterly Actual ─────────────────────────────────────────────────────────

class QuarterlyActualUpdate(BaseModel):
    actual_numeric: Optional[float] = None
    actual_date: Optional[date] = None
    status: GoalStatus

    @model_validator(mode="after")
    def check_actual(self):
        if self.status == GoalStatus.COMPLETED:
            if self.actual_numeric is None and self.actual_date is None:
                raise ValueError("Provide actual_numeric or actual_date when marking Completed")
        return self


class QuarterlyActualRead(BaseModel):
    id: int
    goal_id: int
    cycle_id: int
    actual_numeric: Optional[float] = None
    actual_date: Optional[date] = None
    status: GoalStatus
    progress_score: Optional[float] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Goal Sheet ───────────────────────────────────────────────────────────────

class GoalSheetRead(BaseModel):
    id: int
    employee_id: int
    cycle_id: int
    status: SheetStatus
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    return_reason: Optional[str] = None
    goals: List[GoalRead] = []
    total_weightage: float = 0.0

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def compute_total_weightage(self):
        self.total_weightage = sum(g.weightage for g in self.goals)
        return self


# ── Manager Actions ──────────────────────────────────────────────────────────

class GoalInlineEdit(BaseModel):
    goal_id: int
    weightage: Optional[float] = None
    target_numeric: Optional[float] = None
    target_date: Optional[date] = None


class ManagerApprovalRequest(BaseModel):
    action: str                                    # approve | return
    return_reason: Optional[str] = None
    goal_edits: Optional[List[GoalInlineEdit]] = None

    @field_validator("action")
    @classmethod
    def valid_action(cls, v):
        if v not in ("approve", "return"):
            raise ValueError("action must be 'approve' or 'return'")
        return v


# ── Check-in Comment ─────────────────────────────────────────────────────────

class CheckinCommentCreate(BaseModel):
    comment: str


class CheckinCommentRead(BaseModel):
    id: int
    goal_sheet_id: int
    cycle_id: int
    manager_id: int
    comment: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Shared Goal ──────────────────────────────────────────────────────────────

class SharedGoalPush(BaseModel):
    title: str
    description: Optional[str] = None
    thrust_area_id: int
    uom_type: UoMType
    target_numeric: Optional[float] = None
    target_date: Optional[date] = None
    recipient_ids: List[int]
    default_weightage: float = 10.0

    @field_validator("default_weightage")
    @classmethod
    def check_min(cls, v):
        if v < 10:
            raise ValueError("Minimum weightage is 10%")
        return v


class SharedGoalWeightageUpdate(BaseModel):
    weightage: float

    @field_validator("weightage")
    @classmethod
    def check_min(cls, v):
        if v < 10:
            raise ValueError("Minimum weightage is 10%")
        return v
