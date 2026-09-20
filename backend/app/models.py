from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from .database import Base

class PriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    role = Column(String)  # Admin, Planner, Controller, Engineering
    
class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True) # Engineering, OHE, S&T

class Station(Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    code = Column(String, unique=True)

class RailwaySection(Base):
    __tablename__ = "railway_sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) # e.g. "Pune-Lonavala"
    start_station_id = Column(Integer, ForeignKey("stations.id"))
    end_station_id = Column(Integer, ForeignKey("stations.id"))
    length_km = Column(Float)

class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    section_id = Column(Integer, ForeignKey("railway_sections.id"))
    description = Column(String)
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.MEDIUM)
    duration_minutes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department")
    section = relationship("RailwaySection")

class TrainStatusEnum(str, enum.Enum):
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"
    DELAYED = "DELAYED"

class Train(Base):
    __tablename__ = "trains"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    current_section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=True)
    # Position is a float between 0.0 and 1.0 representing progress along the current section
    position = Column(Float, default=0.0) 
    status = Column(Enum(TrainStatusEnum), default=TrainStatusEnum.STOPPED)

    current_section = relationship("RailwaySection")

class BlockStatusEnum(str, enum.Enum):
    PROPOSED = "PROPOSED"
    APPROVED = "APPROVED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"

class BlockPlan(Base):
    __tablename__ = "block_plans"
    id = Column(Integer, primary_key=True, index=True)
    block_code = Column(String, unique=True, index=True) # e.g. "BLOCK-A17"
    section_id = Column(Integer, ForeignKey("railway_sections.id"))
    start_time = Column(String) # e.g. "02:00"
    end_time = Column(String) # e.g. "05:00"
    duration_minutes = Column(Integer, default=180)
    score = Column(Integer, default=92)
    train_impact_minutes = Column(Integer, default=8)
    departments_count = Column(Integer, default=3)
    priority_jobs = Column(String, default="2 high · 1 medium")
    safety_gate_passed = Column(Integer, default=1) # 1 = PASSED
    rationale = Column(String, default="Low traffic + joint work + no route conflict.")
    status = Column(Enum(BlockStatusEnum), default=BlockStatusEnum.PROPOSED)
    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("RailwaySection")

class TrainMovementHistory(Base):
    __tablename__ = "train_movements_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    train_number = Column(String, index=True)
    train_name = Column(String)
    section_id = Column(Integer, ForeignKey("railway_sections.id"))
    scheduled_departure = Column(String)
    actual_departure = Column(String)
    scheduled_arrival = Column(String)
    actual_arrival = Column(String)
    delay_minutes = Column(Integer, default=0)
    delay_cause = Column(String, default="On-Time")
    has_active_block = Column(Integer, default=0)
    status = Column(String, default="COMPLETED") # COMPLETED or SCHEDULED

    section = relationship("RailwaySection")

class MaintenanceBlockHistory(Base):
    __tablename__ = "maintenance_blocks_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    block_code = Column(String, index=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"))
    start_time = Column(String)
    end_time = Column(String)
    planned_duration_minutes = Column(Integer)
    actual_duration_minutes = Column(Integer)
    departments = Column(String)
    departments_count = Column(Integer, default=1)
    is_joint_block = Column(Integer, default=0)
    train_detention_minutes = Column(Integer, default=0)
    work_completed = Column(String)
    status = Column(String, default="COMPLETED")

    section = relationship("RailwaySection")

class AssetConditionHistory(Base):
    __tablename__ = "asset_condition_history"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"))
    asset_type = Column(String)
    track_quality_index = Column(Float, nullable=True)
    rail_wear_mm = Column(Float, nullable=True)
    ohe_tension_kg = Column(Float, nullable=True)
    point_machine_current_amps = Column(Float, nullable=True)
    health_status = Column(String, default="GOOD")

    section = relationship("RailwaySection")


