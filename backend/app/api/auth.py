from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import hashlib

from ..database import get_db, SessionLocal
from .. import models, schemas
from ..auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_roles,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication & RBAC"],
)

def format_user_response(user: models.User, db: Session) -> schemas.UserResponse:
    dept_name = None
    if user.department_id:
        dept = db.query(models.Department).filter(models.Department.id == user.department_id).first()
        dept_name = dept.name if dept else None

    return schemas.UserResponse(
        id=user.id,
        username=user.username,
        name=user.name,
        email=user.email,
        role=user.role,
        department_id=user.department_id,
        department_name=dept_name,
        active=user.active,
        created_at=user.created_at or datetime.utcnow(),
    )

@router.post("/login", response_model=schemas.TokenResponse)
def login(req: schemas.UserLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user via username & password.
    Returns signed JWT access token and user metadata.
    Logs successful login into the system audit trail.
    """
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact your Operations Supervisor.",
        )

    # Issue JWT Token
    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role,
            "department_id": user.department_id,
        }
    )

    # Log LOGIN event in ApprovalAuditLog
    now = datetime.utcnow()
    raw_sig = f"{user.username}:LOGIN:{user.role}:{now.isoformat()}"
    sig = f"IR-SIG-{hashlib.sha256(raw_sig.encode()).hexdigest()[:24].upper()}"

    audit_entry = models.ApprovalAuditLog(
        action="LOGIN",
        performed_by=user.name,
        user_role=user.role,
        user_id=user.id,
        department=f"Dept #{user.department_id}" if user.department_id else "Operations",
        entity_type="USER_SESSION",
        entity_id=str(user.id),
        previous_state="OFFLINE",
        new_state="AUTHENTICATED",
        timestamp=now,
        digital_signature=sig,
        remarks=f"User '{user.username}' logged in successfully.",
        safety_gate_status="PASSED",
    )
    db.add(audit_entry)
    db.commit()

    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=format_user_response(user, db),
    )

@router.post("/logout")
def logout(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Logs logout in audit trail."""
    now = datetime.utcnow()
    raw_sig = f"{current_user.username}:LOGOUT:{current_user.role}:{now.isoformat()}"
    sig = f"IR-SIG-{hashlib.sha256(raw_sig.encode()).hexdigest()[:24].upper()}"

    audit_entry = models.ApprovalAuditLog(
        action="LOGOUT",
        performed_by=current_user.name,
        user_role=current_user.role,
        user_id=current_user.id,
        department=f"Dept #{current_user.department_id}" if current_user.department_id else "Operations",
        entity_type="USER_SESSION",
        entity_id=str(current_user.id),
        previous_state="AUTHENTICATED",
        new_state="LOGGED_OUT",
        timestamp=now,
        digital_signature=sig,
        remarks=f"User '{current_user.username}' logged out.",
        safety_gate_status="PASSED",
    )
    db.add(audit_entry)
    db.commit()

    return {"message": f"User {current_user.username} successfully logged out."}

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the authenticated user's profile and RBAC role."""
    return format_user_response(current_user, db)

@router.get("/users", response_model=List[schemas.UserResponse])
def list_users(
    current_user: models.User = Depends(require_roles("CENTRAL_CONTROLLER", "SYSTEM_ADMIN")),
    db: Session = Depends(get_db)
):
    """List all system users (restricted to Central Controller and Admin)."""
    users = db.query(models.User).all()
    return [format_user_response(u, db) for u in users]

def seed_default_users(db: Session):
    """Ensures standard Indian Railways users exist for all 4 operational roles."""
    default_users = [
        {
            "username": "controller",
            "name": "Shri R. K. Sharma (Sr. DOM / Chief Controller)",
            "email": "controller.pune@railsync.ir",
            "password": "railpass123",
            "role": models.UserRoleEnum.CENTRAL_CONTROLLER.value,
            "department_id": 4, # Operations
        },
        {
            "username": "eng_track",
            "name": "Er. Amit Verma (Sr. DEN / Track)",
            "email": "eng.track@railsync.ir",
            "password": "railpass123",
            "role": models.UserRoleEnum.ENGINEERING.value,
            "department_id": 1, # Engineering (Track)
        },
        {
            "username": "ohe_traction",
            "name": "Er. S. N. Patil (Sr. DEE / TrD)",
            "email": "ohe.traction@railsync.ir",
            "password": "railpass123",
            "role": models.UserRoleEnum.OHE_TRACTION.value,
            "department_id": 2, # OHE / Traction
        },
        {
            "username": "st_telecom",
            "name": "Er. Priya Nair (Sr. DSTE / Signal)",
            "email": "st.telecom@railsync.ir",
            "password": "railpass123",
            "role": models.UserRoleEnum.SIGNALING_TELECOM.value,
            "department_id": 3, # S&T
        },
        {
            "username": "admin",
            "name": "Chief Signal & Telecom Engineer (CSTE / Admin)",
            "email": "admin@railsync.ir",
            "password": "railpass123",
            "role": models.UserRoleEnum.SYSTEM_ADMIN.value,
            "department_id": 4,
        }
    ]

    for user_info in default_users:
        existing = db.query(models.User).filter(models.User.username == user_info["username"]).first()
        if not existing:
            user = models.User(
                username=user_info["username"],
                name=user_info["name"],
                email=user_info["email"],
                password_hash=hash_password(user_info["password"]),
                role=user_info["role"],
                department_id=user_info["department_id"],
                active=1,
            )
            db.add(user)
    db.commit()
