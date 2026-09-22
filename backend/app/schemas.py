from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .models import PriorityEnum, TrainStatusEnum

# --- Stations ---
class StationBase(BaseModel):
    name: str
    code: str

class StationCreate(StationBase):
    pass

class Station(StationBase):
    id: int
    class Config:
        from_attributes = True

# --- Railway Sections ---
class RailwaySectionBase(BaseModel):
    name: str
    start_station_id: int
    end_station_id: int
    length_km: float

class RailwaySectionCreate(RailwaySectionBase):
    pass

class RailwaySection(RailwaySectionBase):
    id: int
    class Config:
        from_attributes = True

# --- Departments ---
class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

# --- Maintenance Tasks ---
class MaintenanceTaskBase(BaseModel):
    department_id: int
    section_id: int
    description: str
    priority: PriorityEnum
    duration_minutes: int

class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass

class MaintenanceTask(MaintenanceTaskBase):
    id: int
    created_at: datetime
    department: Optional[Department] = None
    section: Optional[RailwaySection] = None
    class Config:
        from_attributes = True


# --- Trains ---
class TrainBase(BaseModel):
    name: str
    current_section_id: Optional[int] = None
    position: float = 0.0
    status: TrainStatusEnum = TrainStatusEnum.STOPPED

class TrainCreate(TrainBase):
    pass

class Train(TrainBase):
    id: int
    current_section: Optional[RailwaySection] = None
    class Config:
        from_attributes = True

# --- Block Plans ---
class BlockPlanBase(BaseModel):
    block_code: str
    section_id: int
    start_time: str
    end_time: str
    duration_minutes: int = 180
    score: int = 92
    train_impact_minutes: int = 8
    departments_count: int = 3
    priority_jobs: str = "2 high · 1 medium"
    safety_gate_passed: int = 1
    rationale: str = "Low traffic + joint work + no route conflict."
    status: str = "PROPOSED"

class BlockPlanCreate(BlockPlanBase):
    pass

class BlockPlan(BlockPlanBase):
    id: int
    created_at: datetime
    section: Optional[RailwaySection] = None
    class Config:
        from_attributes = True

# --- Approval & Audit Schemas (Phase 4) ---
class ApprovalWorkflowRequest(BaseModel):
    block_code: str = "Block A-17"
    section_id: int = 1
    action: str = "APPROVED"  # APPROVED, REJECTED, MODIFIED
    performed_by: str = "Chief Operations Controller (Sr. DOM), Pune Division"
    user_role: str = "Chief Controller"
    remarks: str = "All safety clearance criteria verified. Joint block approved for Track + OHE + S&T."
    emergency_override: bool = False

class ApprovalAuditLogResponse(BaseModel):
    id: int
    block_code: Optional[str] = None
    action: str
    performed_by: str
    user_role: str
    user_id: Optional[int] = None
    department: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    timestamp: datetime
    digital_signature: str
    remarks: str
    safety_gate_status: str
    details_json: Optional[str] = None
    class Config:
        from_attributes = True

# --- ML & Prediction Schemas (Phase 4) ---
class MLDelayPredictRequest(BaseModel):
    section_id: int = 1
    departure_hour: int = 14
    day_of_week: int = 2
    has_active_block: int = 0
    is_vande_bharat: int = 0
    is_freight: int = 0

class MLBlockRiskRequest(BaseModel):
    section_id: int = 1
    duration_minutes: int = 180
    departments_count: int = 3
    start_hour: int = 2

# --- User & Auth Schemas ---
class UserLoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    email: str
    role: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    active: int = 1
    created_at: datetime
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserCreate(BaseModel):
    username: str
    name: str
    email: str
    password: str
    role: str
    department_id: Optional[int] = None

# --- Maintenance Request Schemas ---
class MaintenanceRequestCreate(BaseModel):
    department_id: int
    section_id: int
    work_type: str
    location_details: Optional[str] = None
    asset_id: Optional[str] = None
    priority: PriorityEnum = PriorityEnum.MEDIUM
    duration_minutes: int = 120
    preferred_date: Optional[str] = None
    preferred_start: Optional[str] = "02:00"
    preferred_end: Optional[str] = "04:30"
    required_resources: Optional[str] = None
    reason: str

class MaintenanceRequestUpdateProgress(BaseModel):
    progress_pct: int
    progress_notes: Optional[str] = None

class MaintenanceRequestResponse(BaseModel):
    id: int
    request_number: str
    department_id: int
    department_name: Optional[str] = None
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    section_id: int
    section_name: Optional[str] = None
    work_type: str
    location_details: Optional[str] = None
    asset_id: Optional[str] = None
    priority: str
    duration_minutes: int
    preferred_date: Optional[str] = None
    preferred_start: Optional[str] = None
    preferred_end: Optional[str] = None
    required_resources: Optional[str] = None
    reason: str
    status: str
    rejection_reason: Optional[str] = None
    progress_pct: int = 0
    progress_notes: Optional[str] = None
    block_plan_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    role: Optional[str] = None
    department_id: Optional[int] = None
    title: str
    message: str
    type: str
    link: Optional[str] = None
    is_read: int
    created_at: datetime
    class Config:
        from_attributes = True
