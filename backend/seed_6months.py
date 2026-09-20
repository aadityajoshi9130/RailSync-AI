import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./railtwin.db")
connect_args = {"check_same_thread": False, "timeout": 30.0} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

IR_TRAINS = [
    {"number": "22226", "name": "Solapur-CSMT Vande Bharat", "priority": "CRITICAL", "sections": [5, 4, 3, 1, 2], "base_speed": 110},
    {"number": "22225", "name": "CSMT-Solapur Vande Bharat", "priority": "CRITICAL", "sections": [2, 1, 3, 4, 5], "base_speed": 110},
    {"number": "12124", "name": "Deccan Queen Express", "priority": "HIGH", "sections": [1, 2], "base_speed": 105},
    {"number": "12123", "name": "Deccan Queen Return", "priority": "HIGH", "sections": [2, 1], "base_speed": 105},
    {"number": "12028", "name": "Pune Shatabdi Express", "priority": "HIGH", "sections": [1, 2], "base_speed": 105},
    {"number": "11019", "name": "Konark Express", "priority": "MEDIUM", "sections": [1, 3, 4, 5], "base_speed": 90},
    {"number": "11020", "name": "Konark Express Return", "priority": "MEDIUM", "sections": [5, 4, 3, 1], "base_speed": 90},
    {"number": "12157", "name": "Hutatma Express", "priority": "MEDIUM", "sections": [3, 4, 5], "base_speed": 95},
    {"number": "12158", "name": "Hutatma Express Return", "priority": "MEDIUM", "sections": [5, 4, 3], "base_speed": 95},
    {"number": "11301", "name": "Udyan Express", "priority": "MEDIUM", "sections": [1, 3, 4, 5], "base_speed": 90},
    {"number": "12126", "name": "Pragati Express", "priority": "MEDIUM", "sections": [1, 2], "base_speed": 95},
    {"number": "12128", "name": "Pune Intercity Express", "priority": "MEDIUM", "sections": [1, 2], "base_speed": 95},
    {"number": "BOXN-7041", "name": "BOXN Thermal Coal Rake", "priority": "FREIGHT", "sections": [3, 4, 5], "base_speed": 65},
    {"number": "BTPN-8820", "name": "BTPN Petroleum Rake", "priority": "FREIGHT", "sections": [1, 3, 4], "base_speed": 65},
    {"number": "CONCOR-410", "name": "CONCOR Container Rake", "priority": "FREIGHT", "sections": [2, 1, 3], "base_speed": 70},
]

MONSOON_DELAY_CAUSES = [
    "On-Time", "On-Time", "On-Time",
    "Western Ghats Heavy Rain / Ghat Crawl",
    "Bhor Ghat Caution Order (TSR 30 km/h)",
    "Track Slurry & Mud Clearance",
    "OHE Wet Flashover Precaution",
    "Preceding Train Detention"
]

NORMAL_DELAY_CAUSES = [
    "On-Time", "On-Time", "On-Time", "On-Time", "On-Time", "On-Time",
    "TSR (Temporary Speed Restriction)",
    "Preceding Train Detention",
    "Block Possession Overrun",
    "S&T Point Machine Calibration",
    "OHE Voltage Fluctuation"
]

FESTIVAL_DELAY_CAUSES = [
    "On-Time", "On-Time", "On-Time", "On-Time",
    "Heavy Station Dwell / Passenger Rush",
    "Extra Festival Special Regulation",
    "Platform Congestion at Pune Jn",
    "Preceding Train Detention"
]

WINTER_DELAY_CAUSES = [
    "On-Time", "On-Time", "On-Time", "On-Time",
    "Early Morning Low Visibility / Fog",
    "Cold Weather Patrolling TSR",
    "Rail Stress Neutralization",
    "Preceding Train Detention"
]

MAINT_WORKS = [
    "Ballast tamping & lining with CSM 09-32",
    "USFD ultrasonic rail flaw detection",
    "OHE contact wire droppers & bracket replacement",
    "Track circuit joint insulation renewal",
    "Switch expansion joint (SEJ) adjustment",
    "Turnout point machine 1:12 overhaul",
    "Deep screening with BCM machine",
    "Annual catenary wire inspection",
    "Monsoon culvert desilting & boulder netting in ghats",
    "Flash butt rail welding & destressing"
]

def generate_6months_data():
    db = SessionLocal()
    try:
        # Check if already seeded with 6 months
        past_count = db.query(models.TrainMovementHistory).filter(models.TrainMovementHistory.status == "COMPLETED").count()
        future_count = db.query(models.TrainMovementHistory).filter(models.TrainMovementHistory.status == "SCHEDULED").count()
        
        if past_count >= 5000 and future_count >= 4000:
            print(f"6 months data already seeded ({past_count} past, {future_count} future). Skipping.")
            return

        print("Generating 6 months Historical (March-Sept 2026) & 6 months Future Scheduled (Sept 2026-March 2027)...")

        # Clear existing history to have a clean, coherent 1-year continuous dataset
        db.query(models.TrainMovementHistory).delete()
        db.query(models.MaintenanceBlockHistory).delete()
        db.query(models.AssetConditionHistory).delete()
        db.commit()

        # Date boundaries
        today = datetime(2026, 9, 18)
        past_start = today - timedelta(days=184) # ~March 18, 2026
        future_end = today + timedelta(days=182) # ~March 19, 2027

        past_dates = [(past_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(184)]
        future_dates = [(today + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(182)]

        # ----------------------------------------------------
        # 1. HISTORICAL DATA (PAST 6 MONTHS: March to Sept 2026)
        # ----------------------------------------------------
        block_counter = 1000
        total_blocks_created = 0

        for d_str in past_dates:
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            month = dt.month
            is_monsoon = (month in [6, 7, 8])

            # A. Maintenance Blocks (3-5 per day)
            num_blocks = random.randint(3, 5)
            day_blocks = []
            for _ in range(num_blocks):
                block_counter += 1
                sec_id = random.choice([1, 2, 3, 4, 5])
                start_hour = random.choice([1, 2, 3, 11, 13, 23])
                start_time = f"{start_hour:02d}:{random.choice([0, 15, 30])}"
                planned_dur = random.choice([120, 150, 180, 210])
                
                # In monsoon, slightly higher chance of minor overrun due to rain
                overrun = random.choice([-15, -10, 0, 0, 5, 15, 25]) if not is_monsoon else random.choice([-10, 0, 10, 20, 30])
                actual_dur = max(60, planned_dur + overrun)
                
                is_joint = random.choice([0, 1, 1, 1]) # 75% joint
                if is_joint:
                    dept_list = random.choice([
                        "Engineering (Track), OHE / Traction",
                        "Engineering (Track), S&T (Signalling & Telecom)",
                        "Engineering (Track), OHE / Traction, S&T"
                    ])
                    depts_count = len(dept_list.split(","))
                    detention = random.randint(0, 12)
                else:
                    dept_list = random.choice(["Engineering (Track)", "OHE / Traction", "S&T (Signalling & Telecom)"])
                    depts_count = 1
                    detention = random.randint(8, 28)

                end_hour = (start_hour + planned_dur // 60) % 24
                end_time = f"{end_hour:02d}:{random.choice([0, 15, 30])}"

                block_hist = models.MaintenanceBlockHistory(
                    date=d_str,
                    block_code=f"BLK-CR-{block_counter}",
                    section_id=sec_id,
                    start_time=start_time,
                    end_time=end_time,
                    planned_duration_minutes=planned_dur,
                    actual_duration_minutes=actual_dur,
                    departments=dept_list,
                    departments_count=depts_count,
                    is_joint_block=is_joint,
                    train_detention_minutes=detention,
                    work_completed=random.choice(MAINT_WORKS),
                    status="COMPLETED"
                )
                db.add(block_hist)
                day_blocks.append((sec_id, start_hour, (start_hour + planned_dur // 60) % 24))
                total_blocks_created += 1

            # B. Train Movements (~42-45 movements per day across sections)
            for tr in IR_TRAINS:
                for sec_id in tr["sections"]:
                    sched_dep_h = random.randint(4, 22)
                    sched_dep_m = random.choice([0, 15, 30, 45])
                    dur_min = random.randint(35, 95)
                    sched_arr_h = (sched_dep_h + dur_min // 60) % 24
                    sched_arr_m = (sched_dep_m + dur_min % 60) % 60

                    # Check if overlapping with block in this section
                    has_block = 1 if any(b[0] == sec_id and b[1] <= sched_dep_h <= b[2] for b in day_blocks) else 0

                    # Realistic delay simulation
                    if is_monsoon:
                        cause = random.choice(MONSOON_DELAY_CAUSES)
                    else:
                        cause = random.choice(NORMAL_DELAY_CAUSES)

                    if cause == "On-Time":
                        delay = random.randint(0, 4)
                    else:
                        delay = random.randint(8, 38)
                        if has_block:
                            delay += random.randint(5, 20)
                        if tr["priority"] == "CRITICAL":
                            delay = max(0, delay - 10) # Vande Bharat gets precedence
                        elif tr["priority"] == "FREIGHT":
                            delay += random.randint(5, 15) # Freights loop regulated

                    act_dep_m = (sched_dep_m + delay) % 60
                    act_dep_h = (sched_dep_h + (sched_dep_m + delay) // 60) % 24
                    act_arr_m = (sched_arr_m + delay) % 60
                    act_arr_h = (sched_arr_h + (sched_arr_m + delay) // 60) % 24

                    movement = models.TrainMovementHistory(
                        date=d_str,
                        train_number=tr["number"],
                        train_name=tr["name"],
                        section_id=sec_id,
                        scheduled_departure=f"{sched_dep_h:02d}:{sched_dep_m:02d}",
                        actual_departure=f"{act_dep_h:02d}:{act_dep_m:02d}",
                        scheduled_arrival=f"{sched_arr_h:02d}:{sched_arr_m:02d}",
                        actual_arrival=f"{act_arr_h:02d}:{act_arr_m:02d}",
                        delay_minutes=delay,
                        delay_cause=cause if delay > 4 else "On-Time",
                        has_active_block=has_block,
                        status="COMPLETED"
                    )
                    db.add(movement)

            # C. Asset Condition History (every 2 days)
            if dt.day % 2 == 0:
                for sec_id in [1, 2, 3, 4, 5]:
                    tqi = round(random.uniform(28.0, 44.0), 1)
                    rail_wear = round(random.uniform(0.8, 3.4), 2)
                    ohe_tension = round(random.uniform(980.0, 1050.0), 1)
                    point_amps = round(random.uniform(3.8, 5.4), 2)
                    status = "GOOD" if tqi < 38.0 else ("ATTENTION" if tqi < 42.0 else "CRITICAL")

                    asset_log = models.AssetConditionHistory(
                        date=d_str,
                        section_id=sec_id,
                        asset_type=random.choice(["P-Way Rail Track", "OHE Catenary Wire", "Point Machine 1:12", "Track Circuit"]),
                        track_quality_index=tqi,
                        rail_wear_mm=rail_wear,
                        ohe_tension_kg=ohe_tension,
                        point_machine_current_amps=point_amps,
                        health_status=status
                    )
                    db.add(asset_log)

            # Commit in batches of 30 days
            if dt.day == 1:
                db.commit()

        db.commit()
        print(f"Historical 6 months generated: ~{len(past_dates)*44} train movements, {total_blocks_created} blocks.")

        # ----------------------------------------------------
        # 2. FUTURE SCHEDULED MASTER PLAN (NEXT 6 MONTHS: Sept 2026 to March 2027)
        # ----------------------------------------------------
        print("Generating future 6-month scheduled master plan...")
        future_blocks_created = 0

        for d_str in future_dates:
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            month = dt.month
            is_festival = (month in [10, 11]) # Diwali / Chhath puja traffic surge
            is_winter = (month in [12, 1])   # Winter fog precautions

            # Scheduled Maintenance Possessions (planned master plan: 2-4 planned windows/day)
            num_planned_blocks = random.randint(2, 4)
            for _ in range(num_planned_blocks):
                block_counter += 1
                sec_id = random.choice([1, 2, 3, 4, 5])
                start_hour = random.choice([1, 2, 3, 11, 13])
                planned_dur = random.choice([120, 180, 240])
                end_hour = (start_hour + planned_dur // 60) % 24

                scheduled_block = models.MaintenanceBlockHistory(
                    date=d_str,
                    block_code=f"PLN-CR-{block_counter}",
                    section_id=sec_id,
                    start_time=f"{start_hour:02d}:00",
                    end_time=f"{end_hour:02d}:00",
                    planned_duration_minutes=planned_dur,
                    actual_duration_minutes=None,
                    departments="Engineering (Track), OHE / Traction",
                    departments_count=2,
                    is_joint_block=1,
                    train_detention_minutes=0,
                    work_completed=random.choice(MAINT_WORKS),
                    status="SCHEDULED"
                )
                db.add(scheduled_block)
                future_blocks_created += 1

            # Scheduled Timetable Movements (Daily timetable paths)
            for tr in IR_TRAINS:
                for sec_id in tr["sections"]:
                    sched_dep_h = random.randint(4, 22)
                    sched_dep_m = random.choice([0, 15, 30, 45])
                    dur_min = random.randint(35, 95)
                    sched_arr_h = (sched_dep_h + dur_min // 60) % 24
                    sched_arr_m = (sched_dep_m + dur_min % 60) % 60

                    future_movement = models.TrainMovementHistory(
                        date=d_str,
                        train_number=tr["number"],
                        train_name=tr["name"],
                        section_id=sec_id,
                        scheduled_departure=f"{sched_dep_h:02d}:{sched_dep_m:02d}",
                        actual_departure=None,
                        scheduled_arrival=f"{sched_arr_h:02d}:{sched_arr_m:02d}",
                        actual_arrival=None,
                        delay_minutes=0,
                        delay_cause="SCHEDULED_TIMETABLE",
                        has_active_block=0,
                        status="SCHEDULED"
                    )
                    db.add(future_movement)

            if dt.day == 1:
                db.commit()

        db.commit()
        print(f"Future 6 months scheduled plan generated: ~{len(future_dates)*44} timetable paths, {future_blocks_created} scheduled blocks.")

    finally:
        db.close()

if __name__ == "__main__":
    generate_6months_data()
