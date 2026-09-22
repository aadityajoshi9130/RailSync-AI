import asyncio
import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Set
from sqlalchemy.orm import Session
from ..database import SessionLocal
from .. import models

def get_current_ist_now() -> datetime:
    """Returns current datetime in Indian Standard Time (IST, UTC+5:30)."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist_tz)

class OperationalClockService:
    def __init__(self):
        now_ist = get_current_ist_now()
        self.is_running: bool = True
        self.speed_multiplier: float = 1.0  # 1x, 5x, 10x, 60x
        self.operational_date: str = now_ist.strftime("%Y-%m-%d")
        self.operational_seconds: float = float(now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second)
        self.last_tick_time: float = datetime.now(timezone.utc).timestamp()
        self.subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
        self._initialized = False

    def get_time_string(self) -> str:
        sec = int(self.operational_seconds) % 86400
        h = sec // 3600
        m = (sec % 3600) // 60
        s = sec % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    def get_hm_string(self) -> str:
        sec = int(self.operational_seconds) % 86400
        h = sec // 3600
        m = (sec % 3600) // 60
        return f"{h:02d}:{m:02d}"

    def load_persisted_state(self, db: Session):
        """Loads clock state from system_state table if available."""
        try:
            now_ist = get_current_ist_now()
            today_str = now_ist.strftime("%Y-%m-%d")

            state_row = db.query(models.SystemState).filter(models.SystemState.key == "operational_clock").first()
            if state_row and state_row.value:
                data = json.loads(state_row.value)
                persisted_date = data.get("date", today_str)

                # If persisted date is older than today or invalid, sync to live IST date & time
                if persisted_date != today_str:
                    self.operational_date = today_str
                    self.operational_seconds = float(now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second)
                else:
                    self.operational_date = persisted_date
                    self.operational_seconds = float(data.get("seconds", now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second))

                self.is_running = bool(data.get("is_running", self.is_running))
                self.speed_multiplier = float(data.get("speed_multiplier", self.speed_multiplier))
                print(f"[OperationalClock] Restored state: {self.operational_date} {self.get_time_string()} (speed={self.speed_multiplier}x, running={self.is_running})")
            else:
                self.operational_date = today_str
                self.operational_seconds = float(now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second)
                self.persist_state(db)
        except Exception as e:
            print(f"[OperationalClock] Error loading persisted state: {e}")
        finally:
            self._initialized = True

    def persist_state(self, db: Session):
        """Saves current clock state to system_state table."""
        try:
            payload = json.dumps({
                "date": self.operational_date,
                "seconds": round(self.operational_seconds, 1),
                "time": self.get_time_string(),
                "is_running": self.is_running,
                "speed_multiplier": self.speed_multiplier
            })
            state_row = db.query(models.SystemState).filter(models.SystemState.key == "operational_clock").first()
            if not state_row:
                state_row = models.SystemState(key="operational_clock", value=payload)
                db.add(state_row)
            else:
                state_row.value = payload
                state_row.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[OperationalClock] Error persisting state: {e}")

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self.subscribers.discard(q)

    async def broadcast(self, event_type: str, data: Any):
        if not self.subscribers:
            return
        msg = json.dumps({"type": event_type, "data": data})
        dead = []
        for q in self.subscribers:
            try:
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(msg)
            except Exception:
                dead.append(q)
        for d in dead:
            self.subscribers.discard(d)

    async def control(self, action: str, speed: Optional[float] = None, set_time: Optional[str] = None, set_date: Optional[str] = None) -> Dict[str, Any]:
        async with self._lock:
            if action == "PAUSE":
                self.is_running = False
            elif action == "RESUME":
                self.is_running = True
                self.last_tick_time = datetime.now(timezone.utc).timestamp()
            elif action in ("RESET", "SYNC_REAL_TIME"):
                now_ist = get_current_ist_now()
                self.operational_seconds = float(now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second)
                self.operational_date = now_ist.strftime("%Y-%m-%d")
                self.is_running = True
                self.speed_multiplier = 1.0
                self.last_tick_time = datetime.now(timezone.utc).timestamp()
            elif action == "SPEED" and speed is not None:
                self.speed_multiplier = max(0.1, min(120.0, float(speed)))
            elif action == "SET_TIME" and set_time:
                parts = set_time.split(":")
                h = int(parts[0])
                m = int(parts[1]) if len(parts) > 1 else 0
                s = int(parts[2]) if len(parts) > 2 else 0
                self.operational_seconds = h * 3600 + m * 60 + s
            elif action == "SET_DATE" and set_date:
                self.operational_date = set_date

            db = SessionLocal()
            try:
                self.persist_state(db)
            finally:
                db.close()

            status_data = self.get_status()
            await self.broadcast("CLOCK_CONTROL", status_data)
            return status_data

    def get_status(self) -> Dict[str, Any]:
        return {
            "operational_date": self.operational_date,
            "operational_time": self.get_time_string(),
            "operational_hm": self.get_hm_string(),
            "seconds": self.operational_seconds,
            "is_running": self.is_running,
            "speed_multiplier": self.speed_multiplier,
            "timezone": "Asia/Kolkata (IST)"
        }

    def _parse_time_to_minutes(self, t_str: str) -> int:
        try:
            parts = t_str.strip().split(":")
            return int(parts[0]) * 60 + int(parts[1])
        except Exception:
            return 0

    def evaluate_block_lifecycle(self, db: Session) -> List[Dict[str, Any]]:
        """
        Automated block lifecycle engine:
        - APPROVED blocks whose window matches current time become ACTIVE (restricts section).
        - ACTIVE blocks whose end time is reached become COMPLETED (frees section).
        - Creates cryptographic audit log entries for all transitions.
        """
        current_minute = (int(self.operational_seconds) % 86400) // 60
        lifecycle_events = []

        blocks = db.query(models.BlockPlan).all()
        for b in blocks:
            start_min = self._parse_time_to_minutes(b.start_time)
            end_min = self._parse_time_to_minutes(b.end_time)

            # Handle windows spanning midnight e.g. 23:00 to 02:00
            is_in_window = False
            if start_min <= end_min:
                is_in_window = (start_min <= current_minute < end_min)
            else:
                is_in_window = (current_minute >= start_min or current_minute < end_min)

            # Transition: APPROVED -> ACTIVE
            if b.status == models.BlockStatusEnum.APPROVED and is_in_window:
                b.status = models.BlockStatusEnum.ACTIVE
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                sig_raw = f"{b.block_code}:ACTIVATED:{self.operational_date}:{self.get_time_string()}:IR-SYS"
                sig = f"IR-SIG-{hashlib.sha256(sig_raw.encode()).hexdigest()[:24].upper()}"

                # Update linked maintenance requests to ACTIVE
                linked_reqs = db.query(models.MaintenanceRequest).filter(
                    models.MaintenanceRequest.section_id == b.section_id,
                    models.MaintenanceRequest.status == models.RequestStatusEnum.APPROVED
                ).all()
                for lr in linked_reqs:
                    lr.status = models.RequestStatusEnum.ACTIVE

                # Dispatch notifications
                try:
                    from ..api.notifications import create_notification
                    create_notification(
                        db=db,
                        title=f"Block ACTIVE: {b.block_code}",
                        message=f"Possession is now active on Section #{b.section_id} ({b.start_time}–{b.end_time}). Line restricted.",
                        role="CENTRAL_CONTROLLER",
                        type="ALERT"
                    )
                    for lr in linked_reqs:
                        create_notification(
                            db=db,
                            title=f"Possession Active: {lr.request_number}",
                            message=f"Possession activated for {b.block_code}. Proceed with maintenance execution.",
                            user_id=lr.created_by_id,
                            department_id=lr.department_id,
                            type="INFO"
                        )
                except Exception as e:
                    print(f"Notification error: {e}")

                audit_entry = models.ApprovalAuditLog(
                    block_code=b.block_code,
                    action="BLOCK_ACTIVATED",
                    performed_by="RailSync Automated Operations Scheduler",
                    user_role="System Scheduler",
                    timestamp=now,
                    digital_signature=sig,
                    remarks=f"Automatic Block Activation. Section {b.section_id} is now restricted under active possession.",
                    safety_gate_status="ACTIVE_RESTRICTION",
                    details_json=json.dumps({
                        "block_code": b.block_code,
                        "section_id": b.section_id,
                        "operational_time": self.get_time_string(),
                        "start_time": b.start_time,
                        "end_time": b.end_time
                    })
                )
                db.add(audit_entry)
                lifecycle_events.append({
                    "event": "BLOCK_ACTIVATED",
                    "block_code": b.block_code,
                    "section_id": b.section_id,
                    "status": "ACTIVE"
                })

            # Transition: ACTIVE -> COMPLETED
            elif b.status == models.BlockStatusEnum.ACTIVE and not is_in_window:
                b.status = models.BlockStatusEnum.COMPLETED
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                sig_raw = f"{b.block_code}:COMPLETED:{self.operational_date}:{self.get_time_string()}:IR-SYS"
                sig = f"IR-SIG-{hashlib.sha256(sig_raw.encode()).hexdigest()[:24].upper()}"

                # Update linked maintenance requests to COMPLETED
                linked_reqs = db.query(models.MaintenanceRequest).filter(
                    models.MaintenanceRequest.section_id == b.section_id,
                    models.MaintenanceRequest.status == models.RequestStatusEnum.ACTIVE
                ).all()
                for lr in linked_reqs:
                    lr.status = models.RequestStatusEnum.COMPLETED
                    lr.progress_pct = 100

                # Dispatch completion notifications
                try:
                    from ..api.notifications import create_notification
                    create_notification(
                        db=db,
                        title=f"Block COMPLETED: {b.block_code}",
                        message=f"Possession completed on Section #{b.section_id}. Section reopened to mainline traffic.",
                        role="CENTRAL_CONTROLLER",
                        type="SUCCESS"
                    )
                    for lr in linked_reqs:
                        create_notification(
                            db=db,
                            title=f"Work Completed: {lr.request_number}",
                            message="Possession lifted. Maintenance marked complete in operational log.",
                            user_id=lr.created_by_id,
                            department_id=lr.department_id,
                            type="SUCCESS"
                        )
                except Exception as e:
                    print(f"Notification error: {e}")

                audit_entry = models.ApprovalAuditLog(
                    block_code=b.block_code,
                    action="BLOCK_COMPLETED",
                    performed_by="RailSync Automated Operations Scheduler",
                    user_role="System Scheduler",
                    timestamp=now,
                    digital_signature=sig,
                    remarks=f"Automatic Block Completion. Section {b.section_id} track possession lifted and reopened to traffic.",
                    safety_gate_status="CLEARED_SAFE",
                    details_json=json.dumps({
                        "block_code": b.block_code,
                        "section_id": b.section_id,
                        "operational_time": self.get_time_string(),
                        "completed_at": self.get_time_string()
                    })
                )
                db.add(audit_entry)

                # Record in historical maintenance block history
                history_entry = models.MaintenanceBlockHistory(
                    date=self.operational_date,
                    block_code=b.block_code,
                    section_id=b.section_id,
                    start_time=b.start_time,
                    end_time=b.end_time,
                    planned_duration_minutes=b.duration_minutes,
                    actual_duration_minutes=b.duration_minutes,
                    departments=f"{b.departments_count} coordinated depts",
                    departments_count=b.departments_count,
                    is_joint_block=1 if b.departments_count > 1 else 0,
                    train_detention_minutes=b.train_impact_minutes,
                    work_completed="Joint track, traction & signalling possession completed.",
                    status="COMPLETED"
                )
                db.add(history_entry)

                lifecycle_events.append({
                    "event": "BLOCK_COMPLETED",
                    "block_code": b.block_code,
                    "section_id": b.section_id,
                    "status": "COMPLETED"
                })

        if lifecycle_events:
            db.commit()

        return lifecycle_events

    def step_simulation(self, elapsed_real_seconds: float, db: Session):
        """Advances operational clock and moves trains accordingly."""
        if not self.is_running:
            return

        if self.speed_multiplier == 1.0:
            now_ist = get_current_ist_now()
            self.operational_date = now_ist.strftime("%Y-%m-%d")
            self.operational_seconds = float(now_ist.hour * 3600 + now_ist.minute * 60 + now_ist.second + now_ist.microsecond / 1e6)
        else:
            sim_delta = elapsed_real_seconds * self.speed_multiplier
            self.operational_seconds += sim_delta

            # If crossed midnight, advance operational date
            while self.operational_seconds >= 86400:
                self.operational_seconds -= 86400
                try:
                    cur_dt = datetime.strptime(self.operational_date, "%Y-%m-%d")
                    self.operational_date = (cur_dt + timedelta(days=1)).strftime("%Y-%m-%d")
                except Exception:
                    break
            while self.operational_seconds < 0:
                self.operational_seconds += 86400
                try:
                    cur_dt = datetime.strptime(self.operational_date, "%Y-%m-%d")
                    self.operational_date = (cur_dt - timedelta(days=1)).strftime("%Y-%m-%d")
                except Exception:
                    break

        # 1. Evaluate block lifecycle
        lifecycle_events = self.evaluate_block_lifecycle(db)

        # 2. Get active blocks and restricted sections
        active_blocks = db.query(models.BlockPlan).filter(models.BlockPlan.status == models.BlockStatusEnum.ACTIVE).all()
        restricted_section_ids = {b.section_id for b in active_blocks}

        # 3. Advance trains
        trains = db.query(models.Train).all()
        sections = {s.id: s for s in db.query(models.RailwaySection).all()}

        train_data = []
        for train in trains:
            is_restricted = train.current_section_id in restricted_section_ids
            if is_restricted:
                # Train cannot enter or speed is zeroed on restricted section
                train.status = models.TrainStatusEnum.DELAYED
            else:
                if train.status == models.TrainStatusEnum.DELAYED:
                    train.status = models.TrainStatusEnum.RUNNING

            if train.status == models.TrainStatusEnum.RUNNING:
                # Base step per second
                step = (0.015 * self.speed_multiplier * elapsed_real_seconds)
                train.position = round(train.position + step, 3)

                if train.position >= 1.0:
                    cur_sec = sections.get(train.current_section_id)
                    if cur_sec:
                        next_sec = next(
                            (s for s in sections.values() if s.start_station_id == cur_sec.end_station_id and s.id != cur_sec.id),
                            None
                        )
                        if next_sec and next_sec.id not in restricted_section_ids:
                            train.current_section_id = next_sec.id
                            train.position = 0.0
                        else:
                            # Wait or loop
                            train.position = 0.0
                    else:
                        train.position = 0.0

            sec = sections.get(train.current_section_id)
            train_data.append({
                "id": train.id,
                "name": train.name,
                "current_section_id": train.current_section_id,
                "section_name": sec.name if sec else f"Section {train.current_section_id}",
                "position": train.position,
                "status": train.status.value,
                "is_restricted": is_restricted
            })

        db.commit()
        return train_data, lifecycle_events

# Global Singleton Instance
operational_clock = OperationalClockService()

async def clock_worker():
    """Background task running continuously with FastAPI lifespan."""
    db = SessionLocal()
    try:
        operational_clock.load_persisted_state(db)
    finally:
        db.close()

    persist_counter = 0

    while True:
        try:
            await asyncio.sleep(0.5)  # 500ms precision loop
            now = datetime.now(timezone.utc).timestamp()
            elapsed = now - operational_clock.last_tick_time
            operational_clock.last_tick_time = now

            db = SessionLocal()
            try:
                train_data, lifecycle_events = operational_clock.step_simulation(elapsed, db)

                # Persist state every 5 seconds
                persist_counter += 1
                if persist_counter >= 10:
                    operational_clock.persist_state(db)
                    persist_counter = 0

                # Broadcast clock and train update
                status = operational_clock.get_status()
                await operational_clock.broadcast("CLOCK_TICK", {
                    "clock": status,
                    "trains": train_data,
                    "active_blocks_count": db.query(models.BlockPlan).filter(models.BlockPlan.status == models.BlockStatusEnum.ACTIVE).count()
                })

                if lifecycle_events:
                    await operational_clock.broadcast("LIFECYCLE_EVENT", lifecycle_events)

            finally:
                db.close()

        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"[OperationalClockWorker] Error: {e}")
            await asyncio.sleep(1.0)
