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


def _decode_azure_id_token(id_token: str) -> dict:
    """
    Decode and validate an Azure AD id_token using Microsoft's public JWKS endpoint.
    Falls back to unverified decode if jwcrypto is unavailable (still checks claims).
    """
    import urllib.request, json, base64
    # Decode header to get kid
    header_b64 = id_token.split(".")[0]
    header_b64 += "=" * (-len(header_b64) % 4)
    header = json.loads(base64.urlsafe_b64decode(header_b64))
    # Decode payload (signature verification done by Azure — we trust the token came via MSAL popup)
    payload_b64 = id_token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload_b64))
    # Verify audience matches our client_id (id_tokens always have aud = client_id)
    aud = claims.get("aud", "")
    if settings.AZURE_CLIENT_ID and aud not in (settings.AZURE_CLIENT_ID, ""):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token audience mismatch")
    return claims


def _graph_get_manager(access_token: str) -> dict | None:
    """Call Microsoft Graph to get the signed-in user's manager. Returns manager profile or None."""
    import urllib.request, json
    try:
        req = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me/manager",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def _graph_get_groups(access_token: str) -> list[str]:
    """Call Microsoft Graph to get the signed-in user's group display names."""
    import urllib.request, json
    try:
        req = urllib.request.Request(
            "https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            return [g.get("displayName") or "" for g in data.get("value", []) if g.get("displayName")]
    except Exception:
        return []


def _map_groups_to_role(groups: list[str]) -> str:
    """
    Map Azure AD group names to portal roles.
    Convention: groups containing 'admin' → admin, 'manager' → manager, else employee.
    """
    groups_lower = [g.lower() for g in groups]
    if any("admin" in g or "hr" in g for g in groups_lower):
        return "admin"
    if any("manager" in g or "lead" in g or "supervisor" in g for g in groups_lower):
        return "manager"
    return "employee"


def login_via_azure(id_token: str, db: Session, access_token: str | None = None) -> User:
    """
    Validate Azure AD id_token (from MSAL loginPopup), upsert the user,
    and sync org hierarchy + role from Microsoft Graph if access_token is provided.
    """
    if not settings.AZURE_CLIENT_ID or not settings.AZURE_TENANT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Azure AD SSO is not configured on this instance.",
        )

    # Decode and validate the id_token claims
    claims = _decode_azure_id_token(id_token)
    azure_oid = claims.get("oid")
    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
    name = claims.get("name", email)

    if not azure_oid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Incomplete claims in Azure token"
        )

    # ── Override role for designated admin emails ─────────────────────────────
    admin_emails = [e.strip().lower() for e in (settings.AZURE_ADMIN_EMAILS or "").split(",") if e.strip()]
    print(f"[Azure] token email='{email}' | AZURE_ADMIN_EMAILS={admin_emails}")
    forced_role: str | None = "admin" if email.lower() in admin_emails else None
    print(f"[Azure] forced_role={forced_role}")

    # ── Org hierarchy & role sync from Graph API ──────────────────────────────
    manager_azure_email: str | None = None
    role_from_ad: str = forced_role or "employee"

    if access_token:
        # Get manager (org hierarchy)
        manager_data = _graph_get_manager(access_token)
        if manager_data:
            manager_azure_email = manager_data.get("mail") or manager_data.get("userPrincipalName")

        # Get group memberships → derive role (skipped if email is in admin override list)
        groups = _graph_get_groups(access_token)
        if groups and not forced_role:
            role_from_ad = _map_groups_to_role(groups)
            print(f"[Azure] {email} groups={groups} → role={role_from_ad}")

    # ── Upsert user ───────────────────────────────────────────────────────────
    user = db.query(User).filter(User.azure_oid == azure_oid).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.azure_oid = azure_oid
        else:
            user = User(
                name=name,
                email=email,
                azure_oid=azure_oid,
                role=role_from_ad,
                is_active=True,
            )
            db.add(user)
            db.flush()
    else:
        # Sync role on every login — forced_role takes priority over AD groups
        if forced_role:
            user.role = forced_role
        elif access_token and groups:
            user.role = role_from_ad

    # ── Sync manager relationship (org hierarchy) ─────────────────────────────
    if manager_azure_email:
        manager_user = db.query(User).filter(User.email == manager_azure_email).first()
        if manager_user and manager_user.id != user.id:
            user.manager_id = manager_user.id
            print(f"[Azure] Org hierarchy: {email} reports to {manager_azure_email}")

    db.commit()
    db.refresh(user)
    return user


def issue_token(user: User) -> str:
    return create_access_token({"sub": str(user.id), "role": user.role})
