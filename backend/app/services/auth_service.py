from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from ..models.user import User
from ..core.security import verify_password, hash_password, create_access_token
from ..core.config import settings


def login(email: str, password: str, db: Session) -> User:
    user = db.query(User).filter(User.email == email, User.is_active == True).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user


def get_demo_user(role: str, db: Session) -> User:
    """Return the seeded demo user for a given role — used for judge role-switching."""
    if role not in ("employee", "manager", "admin"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
    demo_emails = {
        "employee": "employee@demo.com",
        "manager": "manager@demo.com",
        "admin": "admin@demo.com",
    }
    user = db.query(User).filter(User.email == demo_emails[role], User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Demo user for role '{role}' not found. Run the seed script first.",
        )
    return user


def login_via_azure(id_token: str, db: Session) -> User:
    """Validate Azure AD id_token via MSAL and upsert the user."""
    import msal

    if not settings.AZURE_CLIENT_ID or not settings.AZURE_TENANT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Azure AD SSO is not configured on this instance.",
        )

    authority = f"https://login.microsoftonline.com/{settings.AZURE_TENANT_ID}"
    app = msal.ConfidentialClientApplication(
        settings.AZURE_CLIENT_ID,
        authority=authority,
        client_credential=settings.AZURE_CLIENT_SECRET,
    )

    # Validate the token using MSAL's token cache / jwks
    result = app.acquire_token_on_behalf_of(
        user_assertion=id_token,
        scopes=["https://graph.microsoft.com/User.Read"],
    )
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Azure token validation failed: {result.get('error_description')}",
        )

    claims = result.get("id_token_claims", {})
    azure_oid = claims.get("oid")
    email = claims.get("preferred_username") or claims.get("email")
    name = claims.get("name", email)

    if not azure_oid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incomplete claims in Azure token"
        )

    # Upsert: find by azure_oid first, then by email
    user = db.query(User).filter(User.azure_oid == azure_oid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.azure_oid = azure_oid
        else:
            # Provision new user — default role is employee; Admin can promote later
            user = User(
                name=name,
                email=email,
                azure_oid=azure_oid,
                role="employee",
                is_active=True,
            )
            db.add(user)

    db.commit()
    db.refresh(user)
    return user


def issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "role": user.role})
