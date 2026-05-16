from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String(100), nullable=False)   # goal | goal_sheet | shared_goal
    entity_id = Column(Integer, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)         # created | updated | locked | approved | returned | unlocked
    field_name = Column(String(255), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    changed_by_user = relationship("User", foreign_keys=[changed_by])
