from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/trains",
    tags=["Trains"],
)

@router.get("", response_model=List[schemas.Train])
def get_trains(db: Session = Depends(get_db)):
    return db.query(models.Train).all()

@router.post("", response_model=schemas.Train)
def create_train(train: schemas.TrainCreate, db: Session = Depends(get_db)):
    db_train = models.Train(
        name=train.name,
        current_section_id=train.current_section_id,
        position=train.position,
        status=train.status
    )
    db.add(db_train)
    db.commit()
    db.refresh(db_train)
    return db_train

@router.post("/simulate-step")
def simulate_step(speed: float = 0.04, db: Session = Depends(get_db)):
    """Advances all running trains by a speed delta along their sections."""
    trains = db.query(models.Train).all()
    sections = {s.id: s for s in db.query(models.RailwaySection).all()}
    
    updated = []
    for train in trains:
        if train.status == models.TrainStatusEnum.RUNNING:
            train.position = round(train.position + speed, 3)
            
            # If reached the end of the section
            if train.position >= 1.0:
                cur_sec = sections.get(train.current_section_id)
                if cur_sec:
                    # Find a section where start_station_id == cur_sec.end_station_id
                    next_sec = next(
                        (s for s in sections.values() if s.start_station_id == cur_sec.end_station_id and s.id != cur_sec.id),
                        None
                    )
                    if next_sec:
                        train.current_section_id = next_sec.id
                        train.position = 0.0
                    else:
                        # Reverse or loop back to first section if at terminal
                        train.position = 0.0
                else:
                    train.position = 0.0
            
            updated.append({
                "id": train.id,
                "name": train.name,
                "current_section_id": train.current_section_id,
                "position": train.position,
                "status": train.status.value
            })
            
    db.commit()
    return {"status": "success", "updated_trains": updated}

@router.post("/reset")
def reset_trains(db: Session = Depends(get_db)):
    """Resets trains to starting positions."""
    trains = db.query(models.Train).all()
    sections = db.query(models.RailwaySection).all()
    
    if not sections:
        return {"status": "error", "message": "No sections found"}
        
    for idx, train in enumerate(trains):
        sec = sections[idx % len(sections)]
        train.current_section_id = sec.id
        train.position = round((idx * 0.25) % 0.8, 2)
        train.status = models.TrainStatusEnum.RUNNING
        
    db.commit()
    return {"status": "success", "message": "Trains reset"}
