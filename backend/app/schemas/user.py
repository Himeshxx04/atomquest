from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    department: Optional[str] = None
    manager_id: Optional[int] = None


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    manager_id: Optional[int] = None
    is_active: bool
    azure_oid: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    manager_id: Optional[int] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class AzureLoginRequest(BaseModel):
    id_token: str


class DemoSwitchRequest(BaseModel):
    role: str   # employee | manager | admin
