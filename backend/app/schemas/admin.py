from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from ..models.goal import CyclePhase


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    department: Optional[str] = None
    manager_id: Optional[int] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[int] = None
    is_active: Optional[bool] = None


class CycleCreate(BaseModel):
    year: int
    phase: CyclePhase
    window_open: date
    window_close: date
    is_active: bool = False


class CycleUpdate(BaseModel):
    window_open: Optional[date] = None
    window_close: Optional[date] = None
    is_active: Optional[bool] = None


class AuditLogRead(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    changed_by: int
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    note: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True


class CompletionStat(BaseModel):
    employee_id: int
    employee_name: str
    department: Optional[str]
    sheet_status: Optional[str]
    has_checkin: bool
    goals_count: int
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]


class EscalationRuleUpdate(BaseModel):
    threshold_days: Optional[int] = None
    notify_chain: Optional[str] = None
    is_active: Optional[bool] = None
