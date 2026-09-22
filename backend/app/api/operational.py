import asyncio
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from pydantic import BaseModel

from ..database import get_db
from .. import models
from ..services.operational_clock import operational_clock

router = APIRouter(
    prefix="/api/operational",
    tags=["Operational Clock & Real-time"],
)

class ClockControlRequest(BaseModel):
    action: str  # PAUSE, RESUME, RESET, SPEED, SET_TIME, SET_DATE
    speed: Optional[float] = None
    set_time: Optional[str] = None
    set_date: Optional[str] = None

@router.get("/clock")
def get_operational_clock():
    """Returns the current authoritative Indian Railways operational clock state."""
    return operational_clock.get_status()

@router.post("/clock/control")
async def control_operational_clock(req: ClockControlRequest):
    """Controls the operational clock: Pause, Resume, Reset, Speed Multiplier, or Time Setting."""
    return await operational_clock.control(
        action=req.action,
        speed=req.speed,
        set_time=req.set_time,
        set_date=req.set_date
    )

@router.get("/state")
def get_operational_state(db: Session = Depends(get_db)):
    """Returns a full synchronized operational snapshot: clock, trains, active blocks, and KPIs."""
    clock_status = operational_clock.get_status()
    trains = db.query(models.Train).all()
    sections = {s.id: s for s in db.query(models.RailwaySection).all()}
    active_blocks = db.query(models.BlockPlan).filter(models.BlockPlan.status == models.BlockStatusEnum.ACTIVE).all()
    proposed_blocks = db.query(models.BlockPlan).filter(models.BlockPlan.status == models.BlockStatusEnum.PROPOSED).all()
    approved_blocks = db.query(models.BlockPlan).filter(models.BlockPlan.status == models.BlockStatusEnum.APPROVED).all()
    open_tasks = db.query(models.MaintenanceTask).all()

    restricted_sections = [b.section_id for b in active_blocks]

    train_list = []
    for t in trains:
        sec = sections.get(t.current_section_id)
        train_list.append({
            "id": t.id,
            "name": t.name,
            "current_section_id": t.current_section_id,
            "section_name": sec.name if sec else f"Section {t.current_section_id}",
            "position": t.position,
            "status": t.status.value,
            "is_restricted": t.current_section_id in restricted_sections
        })

    block_list = []
    for b in (active_blocks + approved_blocks + proposed_blocks):
        sec = sections.get(b.section_id)
        block_list.append({
            "id": b.id,
            "block_code": b.block_code,
            "section_id": b.section_id,
            "section_name": sec.name if sec else f"Section {b.section_id}",
            "start_time": b.start_time,
            "end_time": b.end_time,
            "duration_minutes": b.duration_minutes,
            "score": b.score,
            "status": b.status.value,
            "departments_count": b.departments_count,
            "train_impact_minutes": b.train_impact_minutes
        })

    return {
        "clock": clock_status,
        "trains": train_list,
        "blocks": block_list,
        "kpis": {
            "active_trains_count": len([t for t in trains if t.status == models.TrainStatusEnum.RUNNING]),
            "active_blocks_count": len(active_blocks),
            "approved_blocks_count": len(approved_blocks),
            "open_requests_count": len(open_tasks),
            "asset_availability_pct": 96.4 if len(active_blocks) == 0 else round(100.0 - (len(active_blocks) * 1.8), 1),
            "restricted_sections": restricted_sections
        }
    }

@router.get("/stream")
async def operational_stream():
    """
    Server-Sent Events (SSE) stream providing real-time clock ticks,
    train position updates, block transitions, and heartbeat messages.
    """
    async def event_generator():
        queue = operational_clock.subscribe()
        try:
            # Send initial connection event
            yield f"event: CONNECTED\ndata: {{\"status\": \"connected\", \"clock\": {operational_clock.get_status()}}}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    # Keepalive heartbeat ping
                    yield f": heartbeat {operational_clock.get_time_string()}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            operational_clock.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
