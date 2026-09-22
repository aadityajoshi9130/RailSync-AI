from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(
    prefix="/api/notifications",
    tags=["Notifications"],
)

def create_notification(
    db: Session,
    title: str,
    message: str,
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    type: str = "INFO",
    link: Optional[str] = None
) -> models.Notification:
    """Helper to dispatch role-targeted or department-targeted notifications."""
    notif = models.Notification(
        user_id=user_id,
        role=role,
        department_id=department_id,
        title=title,
        message=message,
        type=type,
        link=link,
        is_read=0,
        created_at=datetime.utcnow()
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

@router.get("", response_model=List[schemas.NotificationResponse])
def get_user_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches chronological notifications relevant to the authenticated user's role and department.
    """
    query = db.query(models.Notification).filter(
        (models.Notification.user_id == current_user.id) |
        (models.Notification.role == current_user.role) |
        ((models.Notification.department_id == current_user.department_id) & (models.Notification.department_id.isnot(None))) |
        ((models.Notification.role.is_(None)) & (models.Notification.department_id.is_(None)) & (models.Notification.user_id.is_(None)))
    )
    return query.order_by(models.Notification.created_at.desc()).limit(50).all()

@router.get("/unread-count")
def get_unread_count(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns the unread notifications count for live badge display."""
    count = db.query(models.Notification).filter(
        models.Notification.is_read == 0,
        (
            (models.Notification.user_id == current_user.id) |
            (models.Notification.role == current_user.role) |
            ((models.Notification.department_id == current_user.department_id) & (models.Notification.department_id.isnot(None)))
        )
    ).count()
    return {"unread_count": count}

@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks an individual notification as read."""
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found.")
    notif.is_read = 1
    db.commit()
    return {"status": "SUCCESS", "id": notification_id}

@router.post("/read-all")
def mark_all_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Marks all user notifications as read."""
    notifications = db.query(models.Notification).filter(
        models.Notification.is_read == 0,
        (
            (models.Notification.user_id == current_user.id) |
            (models.Notification.role == current_user.role) |
            ((models.Notification.department_id == current_user.department_id) & (models.Notification.department_id.isnot(None)))
        )
    ).all()
    for n in notifications:
        n.is_read = 1
    db.commit()
    return {"status": "SUCCESS", "marked_count": len(notifications)}
