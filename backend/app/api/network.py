from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/api/network",
    tags=["Network"],
)

@router.get("/stations", response_model=List[schemas.Station])
def read_stations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    stations = db.query(models.Station).offset(skip).limit(limit).all()
    return stations

@router.post("/stations", response_model=schemas.Station)
def create_station(station: schemas.StationCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Station).filter(models.Station.code == station.code).first()
    if existing:
        return existing
    db_station = models.Station(name=station.name, code=station.code)
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station

@router.get("/sections", response_model=List[schemas.RailwaySection])
def read_sections(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sections = db.query(models.RailwaySection).offset(skip).limit(limit).all()
    return sections

@router.post("/sections", response_model=schemas.RailwaySection)
def create_section(section: schemas.RailwaySectionCreate, db: Session = Depends(get_db)):
    db_section = models.RailwaySection(**section.dict())
    db.add(db_section)
    db.commit()
    db.refresh(db_section)
    return db_section
