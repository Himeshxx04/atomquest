import enum
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey,
    DateTime, Date, Enum, Text, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class UoMType(str, enum.Enum):
    MIN = "min"           # higher is better  e.g. Revenue
    MAX = "max"           # lower is better   e.g. TAT, Cost
    TIMELINE = "timeline" # date-based completion
    ZERO = "zero"         # zero = 100% success  e.g. Safety incidents


class GoalStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    ON_TRACK = "on_track"
    COMPLETED = "completed"


class SheetStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    RETURNED = "returned"   # returned to employee for rework


class CyclePhase(str, enum.Enum):
    GOAL_SETTING = "goal_setting"
    Q1 = "q1"
    Q2 = "q2"
    Q3 = "q3"
    Q4 = "q4"


class Cycle(Base):
    __tablename__ = "cycles"

    id = Column(Integer, primary_key=True)
    year = Column(Integer, nullable=False)
    phase = Column(Enum(CyclePhase), nullable=False)
    window_open = Column(Date, nullable=False)
    window_close = Column(Date, nullable=False)
    is_active = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("year", "phase", name="uq_cycle_year_phase"),)


class ThrustArea(Base):
    __tablename__ = "thrust_areas"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    goals = relationship("Goal", back_populates="thrust_area")


class GoalSheet(Base):
    __tablename__ = "goal_sheets"

    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    status = Column(Enum(SheetStatus), default=SheetStatus.DRAFT, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    return_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("employee_id", "cycle_id", name="uq_sheet_employee_cycle"),
    )

    employee = relationship("User", back_populates="goal_sheets", foreign_keys=[employee_id])
    approved_by_manager = relationship(
        "User", back_populates="approved_sheets", foreign_keys=[approved_by]
    )
    cycle = relationship("Cycle")
    goals = relationship("Goal", back_populates="goal_sheet", cascade="all, delete-orphan")
    checkin_comments = relationship("CheckinComment", back_populates="goal_sheet")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True)
    goal_sheet_id = Column(Integer, ForeignKey("goal_sheets.id"), nullable=False)
    thrust_area_id = Column(Integer, ForeignKey("thrust_areas.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    uom_type = Column(Enum(UoMType), nullable=False)
    target_numeric = Column(Float, nullable=True)
    target_date = Column(Date, nullable=True)
    weightage = Column(Float, nullable=False)
    is_locked = Column(Boolean, default=False)
    is_shared = Column(Boolean, default=False)
    primary_owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("weightage >= 10", name="ck_goal_min_weightage"),
    )

    goal_sheet = relationship("GoalSheet", back_populates="goals")
    thrust_area = relationship("ThrustArea", back_populates="goals")
    primary_owner = relationship("User", foreign_keys=[primary_owner_id])
    shared_links = relationship("SharedGoal", back_populates="goal", cascade="all, delete-orphan")
    quarterly_actuals = relationship(
        "QuarterlyActual", back_populates="goal", cascade="all, delete-orphan"
    )


class SharedGoal(Base):
    """Links a pushed departmental KPI to a recipient employee with their own weightage."""
    __tablename__ = "shared_goals"

    id = Column(Integer, primary_key=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    recipient_employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    weightage = Column(Float, nullable=False)

    __table_args__ = (
        UniqueConstraint("goal_id", "recipient_employee_id", name="uq_shared_goal_recipient"),
        CheckConstraint("weightage >= 10", name="ck_shared_goal_min_weightage"),
    )

    goal = relationship("Goal", back_populates="shared_links")
    recipient = relationship("User", foreign_keys=[recipient_employee_id])


class QuarterlyActual(Base):
    """Employee's logged achievement for a goal in a given quarter."""
    __tablename__ = "quarterly_actuals"

    id = Column(Integer, primary_key=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    actual_numeric = Column(Float, nullable=True)
    actual_date = Column(Date, nullable=True)
    status = Column(Enum(GoalStatus), default=GoalStatus.NOT_STARTED)
    progress_score = Column(Float, nullable=True)   # computed + stored for fast reporting
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("goal_id", "cycle_id", name="uq_actual_goal_cycle"),)

    goal = relationship("Goal", back_populates="quarterly_actuals")
    cycle = relationship("Cycle")


class CheckinComment(Base):
    """Manager's structured comment during a quarterly check-in."""
    __tablename__ = "checkin_comments"

    id = Column(Integer, primary_key=True)
    goal_sheet_id = Column(Integer, ForeignKey("goal_sheets.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    goal_sheet = relationship("GoalSheet", back_populates="checkin_comments")
    manager = relationship("User", foreign_keys=[manager_id])
    cycle = relationship("Cycle")
