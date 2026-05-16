from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class EscalationRule(Base):
    __tablename__ = "escalation_rules"

    id = Column(Integer, primary_key=True)
    # employee_not_submitted | manager_not_approved | checkin_not_completed
    trigger_type = Column(String(100), nullable=False, unique=True)
    threshold_days = Column(Integer, nullable=False)
    # comma-separated escalation chain: employee,manager,hr
    notify_chain = Column(String(255), nullable=False, default="employee,manager,hr")
    is_active = Column(Boolean, default=True)
    description = Column(Text, nullable=True)


class EscalationEvent(Base):
    __tablename__ = "escalation_events"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("escalation_rules.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    escalation_level = Column(Integer, default=1)   # 1=employee notified, 2=manager, 3=HR
    is_resolved = Column(Boolean, default=False)
    note = Column(Text, nullable=True)

    rule = relationship("EscalationRule")
    employee = relationship("User", foreign_keys=[employee_id])
