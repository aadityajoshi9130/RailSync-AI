from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
import hashlib
from datetime import datetime

from .. import models, schemas
from ..database import get_db
from ..services import optimizer
from ..auth import get_current_user, require_roles
from .notifications import create_notification

router = APIRouter(
    prefix="/api/maintenance",
    tags=["Maintenance Demands & Workflows"],
)

def format_request_response(req: models.MaintenanceRequest) -> schemas.MaintenanceRequestResponse:
    return schemas.MaintenanceRequestResponse(
        id=req.id,
        request_number=req.request_number,
        department_id=req.department_id,
        department_name=req.department.name if req.department else f"Dept #{req.department_id}",
        created_by_id=req.created_by_id,
        created_by_name=req.created_by.name if req.created_by else None,
        section_id=req.section_id,
        section_name=req.section.name if req.section else f"Section #{req.section_id}",
        work_type=req.work_type,
        location_details=req.location_details,
        asset_id=req.asset_id,
        priority=req.priority.value if hasattr(req.priority, "value") else str(req.priority),
        duration_minutes=req.duration_minutes,
        preferred_date=req.preferred_date,
        preferred_start=req.preferred_start,
        preferred_end=req.preferred_end,
        required_resources=req.required_resources,
        reason=req.reason,
        status=req.status.value if hasattr(req.status, "value") else str(req.status),
        rejection_reason=req.rejection_reason,
        progress_pct=req.progress_pct or 0,
        progress_notes=req.progress_notes,
        block_plan_id=req.block_plan_id,
        created_at=req.created_at or datetime.utcnow(),
        updated_at=req.updated_at,
    )

@router.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).all()

# =======================================================
# FULL OPERATIONAL MAINTENANCE REQUEST WORKFLOWS
# =======================================================

@router.post("/requests", response_model=schemas.MaintenanceRequestResponse)
def create_maintenance_request(
    req_in: schemas.MaintenanceRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Departmental Maintenance Demand Submission:
    - Enforces department authorization (engineers can only request for their assigned department)
    - Generates unique Indian Railways request tracking number
    - Triggers automated optimization analysis and candidate generation
    - Dispatches high-priority notification to Central Controller
    - Commits cryptographic audit log entry
    """
    # Authorization: Department users cannot submit for other departments
    if current_user.role not in [models.UserRoleEnum.CENTRAL_CONTROLLER.value, models.UserRoleEnum.SYSTEM_ADMIN.value, "CENTRAL_CONTROLLER", "SYSTEM_ADMIN"]:
        if current_user.department_id != req_in.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: You belong to Department #{current_user.department_id} and cannot submit requests for Department #{req_in.department_id}."
            )

    # Generate unique IR request number: REQ-{DEPT}-{YEAR}-{SEQ:04d}
    dept = db.query(models.Department).filter(models.Department.id == req_in.department_id).first()
    dept_name = dept.name if dept else f"Dept {req_in.department_id}"
    
    dept_prefix = "ENG"
    if "OHE" in dept_name.upper() or "TRACTION" in dept_name.upper():
        dept_prefix = "OHE"
    elif "S&T" in dept_name.upper() or "SIGNAL" in dept_name.upper():
        dept_prefix = "ST"
    elif "OPERAT" in dept_name.upper():
        dept_prefix = "OPS"

    current_year = datetime.utcnow().year
    count_existing = db.query(models.MaintenanceRequest).filter(
        models.MaintenanceRequest.department_id == req_in.department_id
    ).count() + 1
    req_number = f"REQ-{dept_prefix}-{current_year}-{count_existing:04d}"

    # Create MaintenanceRequest entity
    db_req = models.MaintenanceRequest(
        request_number=req_number,
        department_id=req_in.department_id,
        created_by_id=current_user.id,
        section_id=req_in.section_id,
        work_type=req_in.work_type,
        location_details=req_in.location_details,
        asset_id=req_in.asset_id,
        priority=req_in.priority,
        duration_minutes=req_in.duration_minutes,
        preferred_date=req_in.preferred_date or datetime.utcnow().strftime("%Y-%m-%d"),
        preferred_start=req_in.preferred_start or "02:00",
        preferred_end=req_in.preferred_end or "04:30",
        required_resources=req_in.required_resources,
        reason=req_in.reason,
        status=models.RequestStatusEnum.SUBMITTED,
        progress_pct=0,
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)

    # Auto-trigger optimization analysis pipeline: generates candidate time windows and joint coordination
    rec = optimizer.generate_corridor_recommendation(req_in.section_id, db)
    db_req.status = models.RequestStatusEnum.UNDER_CONTROLLER_REVIEW

    # Synthesize/update candidate block plan for corridor
    existing_block = db.query(models.BlockPlan).filter(
        models.BlockPlan.section_id == req_in.section_id,
        models.BlockPlan.status.in_([models.BlockStatusEnum.PROPOSED, models.BlockStatusEnum.APPROVED])
    ).first()

    if not existing_block:
        new_block = models.BlockPlan(
            block_code=rec["block_code"],
            section_id=req_in.section_id,
            start_time=rec["start_time"],
            end_time=rec["end_time"],
            duration_minutes=rec["duration_minutes"],
            score=rec["score"],
            train_impact_minutes=rec["train_impact_minutes"],
            departments_count=rec["departments_count"],
            priority_jobs=rec["priority_jobs"],
            safety_gate_passed=rec["safety_gate_passed"],
            rationale=rec["rationale"],
            status=models.BlockStatusEnum.PROPOSED
        )
        db.add(new_block)
        db.commit()
        db.refresh(new_block)
        db_req.block_plan_id = new_block.id
    else:
        existing_block.departments_count = rec["departments_count"]
        existing_block.priority_jobs = rec["priority_jobs"]
        existing_block.score = rec["score"]
        db_req.block_plan_id = existing_block.id

    db.commit()

    # Dispatch notification to Central Controller
    sec = db.query(models.RailwaySection).filter(models.RailwaySection.id == req_in.section_id).first()
    sec_name = sec.name if sec else f"Section #{req_in.section_id}"
    priority_val = req_in.priority.value if hasattr(req_in.priority, "value") else str(req_in.priority)

    create_notification(
        db=db,
        title=f"New Demand: {db_req.request_number} ({priority_val})",
        message=f"{dept_name} submitted {db_req.work_type} on {sec_name} ({db_req.duration_minutes}m). Optimization analysis ready for Controller review.",
        role="CENTRAL_CONTROLLER",
        type="ALERT" if priority_val == "HIGH" else "INFO",
        link="approvals"
    )

    # Dispatched notification to Requesting Department confirming intake
    create_notification(
        db=db,
        title=f"Request {db_req.request_number} Logged",
        message=f"Your {db_req.work_type} demand is queued for Central Controller review.",
        user_id=current_user.id,
        department_id=current_user.department_id,
        type="SUCCESS",
        link="requests"
    )

    # Commit Cryptographic Audit Trail
    now = datetime.utcnow()
    raw_sig = f"{db_req.request_number}:{current_user.username}:SUBMITTED:{now.isoformat()}"
    sig = f"IR-SIG-{hashlib.sha256(raw_sig.encode()).hexdigest()[:24].upper()}"

    audit_entry = models.ApprovalAuditLog(
        block_code=rec["block_code"],
        action="REQUEST_SUBMITTED",
        performed_by=current_user.name,
        user_role=current_user.role,
        user_id=current_user.id,
        department=dept_name,
        entity_type="MAINTENANCE_REQUEST",
        entity_id=db_req.request_number,
        previous_state="DRAFT",
        new_state="UNDER_CONTROLLER_REVIEW",
        timestamp=now,
        digital_signature=sig,
        remarks=f"Submitted {db_req.work_type} ({priority_val} Priority, {db_req.duration_minutes}m). Reason: {db_req.reason}",
        safety_gate_status="AI_CANDIDATES_GENERATED",
        details_json=json.dumps({
            "request_id": db_req.id,
            "request_number": db_req.request_number,
            "work_type": db_req.work_type,
            "section_id": db_req.section_id,
            "priority": priority_val,
            "duration": db_req.duration_minutes
        })
    )
    db.add(audit_entry)
    db.commit()

    return format_request_response(db_req)

@router.get("/requests", response_model=List[schemas.MaintenanceRequestResponse])
def list_maintenance_requests(
    section_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists maintenance requests with strict role-based access:
    - Central Controller & Admin see requests across all departments.
    - Department engineers see ONLY their department's requests.
    """
    query = db.query(models.MaintenanceRequest)

    # Department restriction for non-controllers
    if current_user.role not in [
        models.UserRoleEnum.CENTRAL_CONTROLLER.value,
        models.UserRoleEnum.SYSTEM_ADMIN.value,
        "CENTRAL_CONTROLLER",
        "SYSTEM_ADMIN"
    ]:
        query = query.filter(models.MaintenanceRequest.department_id == current_user.department_id)

    if section_id:
        query = query.filter(models.MaintenanceRequest.section_id == section_id)
    if status_filter:
        query = query.filter(models.MaintenanceRequest.status == status_filter)

    requests = query.order_by(models.MaintenanceRequest.created_at.desc()).all()
    return [format_request_response(r) for r in requests]

@router.get("/requests/{request_id}")
def get_maintenance_request_detail(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns single maintenance request with candidate analysis and joint synergy."""
    req = db.query(models.MaintenanceRequest).filter(models.MaintenanceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")

    # Department restriction
    if current_user.role not in [
        models.UserRoleEnum.CENTRAL_CONTROLLER.value,
        models.UserRoleEnum.SYSTEM_ADMIN.value,
        "CENTRAL_CONTROLLER",
        "SYSTEM_ADMIN"
    ] and current_user.department_id != req.department_id:
        raise HTTPException(status_code=403, detail="Access denied to other department requests.")

    candidates = optimizer.generate_candidate_windows(req.section_id, db)
    joint_info = optimizer.detect_joint_blocks(req.section_id, db)

    return {
        "request": format_request_response(req),
        "ai_analysis": {
            "candidates": candidates,
            "joint_opportunity": joint_info
        }
    }

@router.patch("/requests/{request_id}/progress")
def update_request_progress(
    request_id: int,
    req_update: schemas.MaintenanceRequestUpdateProgress,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Updates work progress (0-100%) and notes for an active or approved maintenance request."""
    req = db.query(models.MaintenanceRequest).filter(models.MaintenanceRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Maintenance request not found.")

    # Department restriction
    if current_user.role not in [
        models.UserRoleEnum.CENTRAL_CONTROLLER.value,
        models.UserRoleEnum.SYSTEM_ADMIN.value,
        "CENTRAL_CONTROLLER",
        "SYSTEM_ADMIN"
    ] and current_user.department_id != req.department_id:
        raise HTTPException(status_code=403, detail="Cannot update progress on other department requests.")

    prev_pct = req.progress_pct
    req.progress_pct = max(0, min(100, req_update.progress_pct))
    if req_update.progress_notes:
        req.progress_notes = req_update.progress_notes

    if req.progress_pct == 100:
        req.status = models.RequestStatusEnum.COMPLETED

    db.commit()

    # Log progress in audit trail
    now = datetime.utcnow()
    raw_sig = f"{req.request_number}:{current_user.username}:{req.progress_pct}%:{now.isoformat()}"
    sig = f"IR-SIG-{hashlib.sha256(raw_sig.encode()).hexdigest()[:24].upper()}"

    audit_entry = models.ApprovalAuditLog(
        block_code=f"BLOCK-REQ-{req.id}",
        action="REQUEST_PROGRESS_UPDATED",
        performed_by=current_user.name,
        user_role=current_user.role,
        user_id=current_user.id,
        department=req.department.name if req.department else "Operations",
        entity_type="MAINTENANCE_REQUEST",
        entity_id=req.request_number,
        previous_state=f"{prev_pct}%",
        new_state=f"{req.progress_pct}%",
        timestamp=now,
        digital_signature=sig,
        remarks=f"Work progress updated to {req.progress_pct}%. Notes: {req.progress_notes or 'None'}",
        safety_gate_status="IN_PROGRESS" if req.progress_pct < 100 else "COMPLETED",
    )
    db.add(audit_entry)
    db.commit()

    return {"status": "SUCCESS", "request_number": req.request_number, "progress_pct": req.progress_pct}

# =======================================================
# BACKWARD COMPATIBILITY: TASKS CRUD
# =======================================================

@router.get("/tasks", response_model=List[schemas.MaintenanceTask])
def get_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.MaintenanceTask).offset(skip).limit(limit).all()

@router.post("/tasks", response_model=schemas.MaintenanceTask)
def create_task(task: schemas.MaintenanceTaskCreate, db: Session = Depends(get_db)):
    db_task = models.MaintenanceTask(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task
