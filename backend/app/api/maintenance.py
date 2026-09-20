from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime

from .. import models, schemas
from ..database import get_db
from ..services import optimizer
from ..services.operational_clock import operational_clock

router = APIRouter(
    prefix="/api/maintenance",
    tags=["Maintenance"],
)

@router.get("/departments", response_model=List[schemas.Department])
def get_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).all()

@router.get("/tasks", response_model=List[schemas.MaintenanceTask])
def get_tasks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.MaintenanceTask).offset(skip).limit(limit).all()

@router.post("/tasks", response_model=schemas.MaintenanceTask)
def create_task(task: schemas.MaintenanceTaskCreate, db: Session = Depends(get_db)):
    db_task = models.MaintenanceTask(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # Automatically synthesize/update candidate block plan for this section
    rec = optimizer.generate_corridor_recommendation(task.section_id, db)
    existing_block = db.query(models.BlockPlan).filter(
        models.BlockPlan.section_id == task.section_id,
        models.BlockPlan.status.in_([models.BlockStatusEnum.PROPOSED, models.BlockStatusEnum.APPROVED])
    ).first()

    if not existing_block:
        new_block = models.BlockPlan(
            block_code=rec["block_code"],
            section_id=task.section_id,
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
    else:
        existing_block.departments_count = rec["departments_count"]
        existing_block.priority_jobs = rec["priority_jobs"]
        existing_block.score = rec["score"]

    # Log to audit trail
    dept_name = db_task.department.name if db_task.department else f"Dept #{task.department_id}"
    audit_entry = models.ApprovalAuditLog(
        block_code=rec["block_code"],
        action="REQUEST_CREATED",
        performed_by=f"Maintenance Engineer ({dept_name})",
        user_role="Department Engineer",
        timestamp=datetime.utcnow(),
        digital_signature=f"IR-REQ-{db_task.id:04d}",
        remarks=f"New demand: {db_task.description} ({db_task.priority} Priority, {db_task.duration_minutes}m).",
        safety_gate_status="QUEUED_FOR_AI_OPTIMIZATION",
        details_json=json.dumps({
            "task_id": db_task.id,
            "section_id": task.section_id,
            "priority": db_task.priority.value,
            "duration": db_task.duration_minutes
        })
    )
    db.add(audit_entry)
    db.commit()

    return db_task
