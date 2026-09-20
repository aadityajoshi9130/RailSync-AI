from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from .. import models
from ..database import get_db
from ..services import ml_engine

router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics & ML"],
)

class DelayPredictionRequest(BaseModel):
    section_id: int = 1
    departure_hour: int = 8
    day_of_week: int = 2 # 0=Mon, 6=Sun
    has_active_block: int = 0
    is_vande_bharat: int = 0
    is_freight: int = 0

@router.get("/summary")
def get_summary(days: int = 180, db: Session = Depends(get_db)):
    """Returns 6-month / 30-day Indian Railways operational summary and ML metrics."""
    return ml_engine.get_30day_summary(db, days=days)

@router.get("/punctuality-trend")
def get_punctuality_trend(days: int = 180, db: Session = Depends(get_db)):
    """Returns daily punctuality trend over specified history (default 180 days)."""
    return ml_engine.get_punctuality_trend(db, days=days)

@router.get("/hourly-congestion")
def get_hourly_congestion(db: Session = Depends(get_db)):
    """Returns 24-hour congestion density across all corridors."""
    return ml_engine.get_hourly_congestion(db)

@router.post("/advance-day")
def advance_day(date: Optional[str] = None, db: Session = Depends(get_db)):
    """Advances operational date by 1 day, archiving live movements and extending the 6-month master plan."""
    from ..services.daily_rolling_engine import advance_operational_day
    return advance_operational_day(db, target_date_str=date)

@router.post("/predict-delay")
def predict_delay(req: DelayPredictionRequest):
    """Predicts expected train delay using the trained Random Forest model."""
    return ml_engine.ml_engine.predict(
        section_id=req.section_id,
        departure_hour=req.departure_hour,
        day_of_week=req.day_of_week,
        has_active_block=req.has_active_block,
        is_vande_bharat=req.is_vande_bharat,
        is_freight=req.is_freight
    )

@router.post("/retrain-model")
def retrain_model(db: Session = Depends(get_db)):
    """Forces retraining of the ML model on the 30-day dataset."""
    metrics = ml_engine.ml_engine.train_model(db)
    return {"status": "success", "metrics": metrics}

@router.get("/audit-history")
def get_audit_history(limit: int = 50, db: Session = Depends(get_db)):
    """Returns 30-day historical maintenance block audit logs."""
    blocks = (
        db.query(models.MaintenanceBlockHistory)
        .order_by(models.MaintenanceBlockHistory.id.desc())
        .limit(limit)
        .all()
    )
    result = []
    for b in blocks:
        result.append({
            "id": b.id,
            "date": b.date,
            "block_code": b.block_code,
            "section_name": b.section.name if b.section else f"Section {b.section_id}",
            "start_time": b.start_time,
            "end_time": b.end_time,
            "planned_duration": b.planned_duration_minutes,
            "actual_duration": b.actual_duration_minutes,
            "departments": b.departments,
            "is_joint_block": b.is_joint_block,
            "train_detention_minutes": b.train_detention_minutes,
            "work_completed": b.work_completed,
            "status": b.status
        })
    return result
