import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .. import models

def advance_operational_day(db: Session, target_date_str: str = None):
    """
    Advances the operational system by 1 day:
    1. Converts today's scheduled movements into completed operational records with realistic variance.
    2. Completes today's scheduled maintenance blocks.
    3. Adds a new day at the end of the 180-day future horizon to keep the live schedule permanently rolling.
    """
    if not target_date_str:
        # Find earliest SCHEDULED date in the database
        earliest_sched = db.query(models.TrainMovementHistory.date)\
            .filter(models.TrainMovementHistory.status == "SCHEDULED")\
            .order_by(models.TrainMovementHistory.date.asc())\
            .first()
        
        target_date_str = earliest_sched[0] if earliest_sched else datetime.now().strftime("%Y-%m-%d")

    target_dt = datetime.strptime(target_date_str, "%Y-%m-%d")

    # 1. Complete today's scheduled blocks
    sched_blocks = db.query(models.MaintenanceBlockHistory)\
        .filter(models.MaintenanceBlockHistory.date == target_date_str, models.MaintenanceBlockHistory.status == "SCHEDULED")\
        .all()
    
    for b in sched_blocks:
        b.status = "COMPLETED"
        overrun = random.choice([-15, -10, 0, 0, 5, 15, 20])
        b.actual_duration_minutes = max(60, (b.planned_duration_minutes or 180) + overrun)
        b.train_detention_minutes = random.randint(0, 14) if b.is_joint_block else random.randint(10, 25)

    # 2. Complete today's scheduled train movements
    sched_trains = db.query(models.TrainMovementHistory)\
        .filter(models.TrainMovementHistory.date == target_date_str, models.TrainMovementHistory.status == "SCHEDULED")\
        .all()

    completed_count = 0
    total_delay = 0
    for tr in sched_trains:
        tr.status = "COMPLETED"
        dep_h = int(tr.scheduled_departure.split(":")[0])
        dep_m = int(tr.scheduled_departure.split(":")[1])
        
        # Check if block exists on this section
        has_block = 1 if any(b.section_id == tr.section_id for b in sched_blocks) else 0
        tr.has_active_block = has_block

        # Operational delay distribution
        is_delayed = random.random() < (0.28 if not has_block else 0.55)
        if not is_delayed:
            delay = random.randint(0, 4)
            cause = "On-Time"
        else:
            delay = random.randint(7, 32)
            if "Vande Bharat" in tr.train_name:
                delay = max(2, delay - 10)
                cause = "Preceding Train Detention"
            elif "BOXN" in tr.train_name or "BTPN" in tr.train_name or "CONCOR" in tr.train_name:
                delay += random.randint(5, 15)
                cause = "Freight Regulation / Loop Stabling"
            else:
                cause = random.choice(["TSR Speed Restriction", "S&T Signal Calibration", "Preceding Train Detention"])

        tr.delay_minutes = delay
        tr.delay_cause = cause
        
        arr_h = int(tr.scheduled_arrival.split(":")[0])
        arr_m = int(tr.scheduled_arrival.split(":")[1])

        tr.actual_departure = f"{(dep_h + (dep_m + delay) // 60) % 24:02d}:{(dep_m + delay) % 60:02d}"
        tr.actual_arrival = f"{(arr_h + (arr_m + delay) // 60) % 24:02d}:{(arr_m + delay) % 60:02d}"
        
        completed_count += 1
        total_delay += delay

    # 3. Add 1 future day at the end of the 180-day horizon (target_dt + 182 days)
    new_future_dt = target_dt + timedelta(days=182)
    new_future_str = new_future_dt.strftime("%Y-%m-%d")

    IR_TRAINS = [
        {"number": "22226", "name": "Solapur-CSMT Vande Bharat", "sections": [5, 4, 3, 1, 2]},
        {"number": "22225", "name": "CSMT-Solapur Vande Bharat", "sections": [2, 1, 3, 4, 5]},
        {"number": "12124", "name": "Deccan Queen Express", "sections": [1, 2]},
        {"number": "12123", "name": "Deccan Queen Return", "sections": [2, 1]},
        {"number": "12028", "name": "Pune Shatabdi Express", "sections": [1, 2]},
        {"number": "11019", "name": "Konark Express", "sections": [1, 3, 4, 5]},
        {"number": "11020", "name": "Konark Express Return", "sections": [5, 4, 3, 1]},
        {"number": "12157", "name": "Hutatma Express", "sections": [3, 4, 5]},
        {"number": "12158", "name": "Hutatma Express Return", "sections": [5, 4, 3]},
        {"number": "11301", "name": "Udyan Express", "sections": [1, 3, 4, 5]},
        {"number": "12126", "name": "Pragati Express", "sections": [1, 2]},
        {"number": "12128", "name": "Pune Intercity Express", "sections": [1, 2]},
        {"number": "BOXN-7041", "name": "BOXN Thermal Coal Rake", "sections": [3, 4, 5]},
        {"number": "BTPN-8820", "name": "BTPN Petroleum Rake", "sections": [1, 3, 4]},
    ]
    MAINT_WORKS = [
        "Ballast tamping & lining with CSM 09-32",
        "USFD ultrasonic rail flaw detection",
        "OHE contact wire droppers & bracket replacement",
        "Track circuit joint insulation renewal",
        "Switch expansion joint (SEJ) adjustment",
        "Turnout point machine 1:12 overhaul",
        "Deep screening with BCM machine",
        "Annual catenary wire inspection"
    ]
    
    # 2-3 planned future blocks
    for _ in range(random.randint(2, 3)):
        sec_id = random.choice([1, 2, 3, 4, 5])
        st_h = random.choice([1, 2, 3, 11, 13])
        dur = random.choice([120, 180, 240])
        db.add(models.MaintenanceBlockHistory(
            date=new_future_str,
            block_code=f"PLN-CR-{random.randint(5000, 9999)}",
            section_id=sec_id,
            start_time=f"{st_h:02d}:00",
            end_time=f"{(st_h + dur // 60) % 24:02d}:00",
            planned_duration_minutes=dur,
            actual_duration_minutes=None,
            departments="Engineering (Track), OHE / Traction",
            departments_count=2,
            is_joint_block=1,
            train_detention_minutes=0,
            work_completed=random.choice(MAINT_WORKS),
            status="SCHEDULED"
        ))

    # Future train paths
    for t_item in IR_TRAINS:
        for s_id in t_item["sections"]:
            d_h = random.randint(4, 22)
            d_m = random.choice([0, 15, 30, 45])
            dur_m = random.randint(35, 95)
            db.add(models.TrainMovementHistory(
                date=new_future_str,
                train_number=t_item["number"],
                train_name=t_item["name"],
                section_id=s_id,
                scheduled_departure=f"{d_h:02d}:{d_m:02d}",
                actual_departure=None,
                scheduled_arrival=f"{(d_h + dur_m // 60) % 24:02d}:{(d_m + dur_m % 60) % 60:02d}",
                actual_arrival=None,
                delay_minutes=0,
                delay_cause="SCHEDULED_TIMETABLE",
                has_active_block=0,
                status="SCHEDULED"
            ))

    db.commit()

    return {
        "status": "success",
        "advanced_date": target_date_str,
        "completed_trains": completed_count,
        "avg_delay_minutes": round(total_delay / max(1, completed_count), 1),
        "completed_blocks": len(sched_blocks),
        "extended_horizon_date": new_future_str
    }
