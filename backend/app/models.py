from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Float
from sqlalchemy.orm import relationship
import enum
from datetime import datetime

from .database import Base

class UserRoleEnum(str, enum.Enum):
    CENTRAL_CONTROLLER = "CENTRAL_CONTROLLER"
    ENGINEERING = "ENGINEERING"
    OHE_TRACTION = "OHE_TRACTION"
    SIGNALING_TELECOM = "SIGNALING_TELECOM"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"

class PriorityEnum(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default=UserRoleEnum.ENGINEERING.value)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    active = Column(Integer, default=1)  # 1 = active, 0 = inactive
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department")
    
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

class RequestStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    RECEIVED = "RECEIVED"
    AI_ANALYZING = "AI_ANALYZING"
    RECOMMENDED = "RECOMMENDED"
    UNDER_CONTROLLER_REVIEW = "UNDER_CONTROLLER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REVISION_REQUIRED = "REVISION_REQUIRED"
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"
    id = Column(Integer, primary_key=True, index=True)
    request_number = Column(String, unique=True, index=True, nullable=False) # e.g. "REQ-ENG-0241"
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("railway_sections.id"), nullable=False)
    work_type = Column(String, nullable=False) # e.g. "Track Renewal", "Deep Screening", "OHE Catenary Inspection", "Point Machine Replacement"
    location_details = Column(String, nullable=True) # e.g. "Km 114/2 - 116/8 UP Line"
    asset_id = Column(String, nullable=True) # e.g. "PM-402", "OHE-SEC-2", "TRK-98"
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.MEDIUM)
    duration_minutes = Column(Integer, nullable=False, default=120)
    preferred_date = Column(String, nullable=True) # e.g. "2026-09-22"
    preferred_start = Column(String, nullable=True) # e.g. "02:00"
    preferred_end = Column(String, nullable=True) # e.g. "04:30"
    required_resources = Column(String, nullable=True) # e.g. "1x BCM, 15 Trackmen, 1 Tamping machine"
    reason = Column(String, nullable=False)
    status = Column(Enum(RequestStatusEnum), default=RequestStatusEnum.SUBMITTED)
    rejection_reason = Column(String, nullable=True)
    progress_pct = Column(Integer, default=0) # 0 to 100
    progress_notes = Column(String, nullable=True)
    block_plan_id = Column(Integer, ForeignKey("block_plans.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department")
    created_by = relationship("User")
    section = relationship("RailwaySection")
    block_plan = relationship("BlockPlan")

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

class ApprovalAuditLog(Base):
    __tablename__ = "approval_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    block_code = Column(String, index=True, nullable=True)
    action = Column(String) # "APPROVED", "REJECTED", "MODIFIED", "EMERGENCY_OVERRIDE", "SUBMITTED", "LOGIN", "LOGOUT", "REQUEST_CREATED"
    performed_by = Column(String) # e.g. "Sr. DOM (Pune Division)"
    user_role = Column(String) # e.g. "Chief Operations Controller"
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    department = Column(String, nullable=True)
    entity_type = Column(String, nullable=True) # "BLOCK", "MAINTENANCE_REQUEST", "USER_SESSION"
    entity_id = Column(String, nullable=True)
    previous_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    digital_signature = Column(String) # SHA-256 HMAC cryptographic signature
    remarks = Column(String)
    safety_gate_status = Column(String, default="PASSED")
    details_json = Column(String, nullable=True)

    user = relationship("User")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role = Column(String, nullable=True) # e.g. "CENTRAL_CONTROLLER", "ENGINEERING"
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="INFO") # INFO, WARNING, SUCCESS, ALERT
    link = Column(String, nullable=True)
    is_read = Column(Integer, default=0) # 0 = unread, 1 = read
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    department = relationship("Department")

class SystemState(Base):
    __tablename__ = "system_state"
    key = Column(String, primary_key=True, index=True)
    value = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

