from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ...core.database import get_db
from ...core.security import get_current_user
from ...schemas.user import LoginRequest, TokenResponse, AzureLoginRequest, DemoSwitchRequest, UserRead
from ...services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.login(body.email, body.password, db)
    token = auth_service.issue_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/azure", response_model=TokenResponse)
def azure_login(body: AzureLoginRequest, db: Session = Depends(get_db)):
    """SSO via Microsoft Entra ID — accepts the id_token from MSAL on the frontend."""
    user = auth_service.login_via_azure(body.id_token, db)
    token = auth_service.issue_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/demo-switch", response_model=TokenResponse)
def demo_switch(body: DemoSwitchRequest, db: Session = Depends(get_db)):
    """
    Judge-facing endpoint: instantly switch to a demo user by role.
    Returns a fresh JWT — no password needed.
    Only available when ENVIRONMENT=development.
    """
    from ...core.config import settings
    from fastapi import HTTPException, status

    if settings.ENVIRONMENT != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo switch is only available in development mode",
        )
    user = auth_service.get_demo_user(body.role, db)
    token = auth_service.issue_token(user)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(current_user=Depends(get_current_user)):
    return current_user
