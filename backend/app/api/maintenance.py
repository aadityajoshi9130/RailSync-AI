from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

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
    return db_task
