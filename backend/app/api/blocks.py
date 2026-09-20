from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from pydantic import BaseModel
from .. import models, schemas
from ..database import get_db
from ..services import optimizer

router = APIRouter(
    prefix="/api/blocks",
    tags=["Block Planning"],
)

class WhatIfRequest(BaseModel):
    scenario_type: str = "train_delay"
    section_id: int = 1
    magnitude: int = 30
    train_number: str = "12028"
    time_of_day: str = "14:00"

@router.post("/simulate-whatif")
def simulate_whatif(req: WhatIfRequest, db: Session = Depends(get_db)):
    """Simulates train operational shock, cascading delays, and AI mitigation."""
    from ..services import whatif_engine
    return whatif_engine.run_whatif_simulation(
        db=db,
        scenario_type=req.scenario_type,
        section_id=req.section_id,
        magnitude=req.magnitude,
        train_number=req.train_number,
        time_of_day=req.time_of_day
    )


@router.get("/recommendation")
def get_ai_recommendation(section_id: int = 1, db: Session = Depends(get_db)):
    """Returns AI-optimized maintenance block plan for corridor."""
    return optimizer.generate_corridor_recommendation(section_id, db)

@router.get("/conflicts")
def get_conflicts(section_id: int = 1, start_time: str = "02:00", end_time: str = "05:00", db: Session = Depends(get_db)):
    """Checks corridor conflicts between train traffic and maintenance."""
    return optimizer.analyze_conflicts(section_id, start_time, end_time, db)

@router.get("", response_model=List[schemas.BlockPlan])
def list_blocks(db: Session = Depends(get_db)):
    return db.query(models.BlockPlan).all()

@router.post("/approve")
def approve_block(block_code: str = "Block A-17", section_id: int = 1, db: Session = Depends(get_db)):
    """Approves and activates a proposed block plan."""
    block = db.query(models.BlockPlan).filter(models.BlockPlan.block_code == block_code).first()
    if not block:
        block = models.BlockPlan(
            block_code=block_code,
            section_id=section_id,
            start_time="02:00",
            end_time="05:00",
            duration_minutes=180,
            score=92,
            train_impact_minutes=8,
            departments_count=3,
            priority_jobs="2 high · 1 medium",
            safety_gate_passed=1,
            rationale="Approved by Chief Controller.",
            status=models.BlockStatusEnum.APPROVED
        )
        db.add(block)
    else:
        block.status = models.BlockStatusEnum.APPROVED
        
    db.commit()
    db.refresh(block)
    return {"status": "success", "message": f"{block_code} approved successfully!", "block": block.block_code}
