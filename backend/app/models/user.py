from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)   # null for Azure SSO users
    role = Column(String(50), nullable=False)               # employee | manager | admin
    department = Column(String(255), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    azure_oid = Column(String(255), unique=True, nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    manager = relationship("User", remote_side=[id], backref="direct_reports")
    goal_sheets = relationship(
        "GoalSheet", back_populates="employee", foreign_keys="GoalSheet.employee_id"
    )
    approved_sheets = relationship(
        "GoalSheet", back_populates="approved_by_manager", foreign_keys="GoalSheet.approved_by"
    )
