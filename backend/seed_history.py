import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./railtwin.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

IR_TRAINS = [
    {"number": "22226", "name": "Solapur-CSMT Vande Bharat", "priority": "CRITICAL", "sections": [5, 4, 3, 1, 2]},
    {"number": "22225", "name": "CSMT-Solapur Vande Bharat", "priority": "CRITICAL", "sections": [2, 1, 3, 4, 5]},
    {"number": "12124", "name": "Deccan Queen Express", "priority": "HIGH", "sections": [1, 2]},
    {"number": "12123", "name": "Deccan Queen Return", "priority": "HIGH", "sections": [2, 1]},
    {"number": "12028", "name": "Pune Shatabdi Express", "priority": "HIGH", "sections": [1, 2]},
    {"number": "11019", "name": "Konark Express", "priority": "MEDIUM", "sections": [1, 3, 4, 5]},
    {"number": "11020", "name": "Konark Express Return", "priority": "MEDIUM", "sections": [5, 4, 3, 1]},
    {"number": "12157", "name": "Hutatma Express", "priority": "MEDIUM", "sections": [3, 4, 5]},
    {"number": "12158", "name": "Hutatma Express Return", "priority": "MEDIUM", "sections": [5, 4, 3]},
    {"number": "11301", "name": "Udyan Express", "priority": "MEDIUM", "sections": [1, 3, 4, 5]},
    {"number": "12126", "name": "Pragati Express", "priority": "MEDIUM", "sections": [1, 2]},
    {"number": "12128", "name": "Pune Intercity Express", "priority": "MEDIUM", "sections": [1, 2]},
    {"number": "BOXN-7041", "name": "BOXN Thermal Coal Rake", "priority": "FREIGHT", "sections": [3, 4, 5]},
    {"number": "BTPN-8820", "name": "BTPN Petroleum Rake", "priority": "FREIGHT", "sections": [1, 3, 4]},
]

DELAY_CAUSES = [
    "On-Time",
    "On-Time",
    "On-Time",
    "On-Time",
    "On-Time",
    "On-Time",
    "On-Time",
    "TSR (Temporary Speed Restriction)",
    "Preceding Train Detention",
    "Block Possession Overrun",
    "S&T Point Machine Calibration",
    "OHE Voltage Fluctuation",
    "Heavy Rain / Weather"
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

def seed_history():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    existing_count = db.query(models.TrainMovementHistory).count()
    if existing_count >= 500:
        print(f"30-day historical data already exists ({existing_count} records). Skipping.")
        return

    print("Generating 30 days of Indian Railways operational data (Central Railway)...")

    # Start date 30 days ago up to today
    base_date = datetime(2026, 9, 17)
    dates = [(base_date - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]

    # 1. Generate Historical Maintenance Blocks (approx 3-5 per day)
    block_records = []
    block_counter = 100
    for d in dates:
        num_blocks = random.randint(3, 5)
        for _ in range(num_blocks):
            block_counter += 1
            sec_id = random.choice([1, 2, 3, 4, 5])
            start_hour = random.choice([1, 2, 3, 11, 13, 23])
            start_time = f"{start_hour:02d}:{random.choice([0, 15, 30])}"
            planned_dur = random.choice([120, 150, 180, 210])
            actual_dur = planned_dur + random.choice([-15, -10, 0, 0, 5, 15, 25])
            
            # Joint vs Single Department
            is_joint = random.choice([0, 1, 1, 1]) # 75% joint in optimized regime
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

            end_hour = (start_hour + (actual_dur // 60)) % 24
            end_time = f"{end_hour:02d}:{(actual_dur % 60):02d}"

            block = models.MaintenanceBlockHistory(
                date=d,
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
            block_records.append(block)

    db.add_all(block_records)
    db.commit()
    print(f"Seeded {len(block_records)} maintenance block historical records.")

    # 2. Generate Historical Train Movement Logs
    movement_records = []
    for d in dates:
        day_of_week = datetime.strptime(d, "%Y-%m-%d").weekday()
        for train in IR_TRAINS:
            # Generate movements across its sections
            dep_hour = random.randint(5, 22)
            dep_min = random.choice([10, 25, 40, 55])
            
            current_time = datetime.strptime(f"{d} {dep_hour:02d}:{dep_min:02d}", "%Y-%m-%d %H:%M")

            for sec_id in train["sections"]:
                # Travel duration in minutes based on section
                base_travel_mins = random.randint(35, 75)
                
                # Check if this day/section had active block
                has_block = 1 if (dep_hour in [1, 2, 3, 11, 13] and random.random() < 0.3) else 0
                
                # Delay calculation
                cause = random.choice(DELAY_CAUSES)
                if has_block:
                    delay = random.randint(4, 18)
                    cause = "Block Possession Overrun" if delay > 12 else "TSR (Temporary Speed Restriction)"
                elif cause == "On-Time":
                    delay = random.randint(0, 4)
                else:
                    delay = random.randint(8, 35)

                sched_dep_str = current_time.strftime("%H:%M")
                act_dep = current_time + timedelta(minutes=random.randint(0, max(1, delay // 2)))
                act_dep_str = act_dep.strftime("%H:%M")

                arr_time = current_time + timedelta(minutes=base_travel_mins)
                sched_arr_str = arr_time.strftime("%H:%M")
                act_arr = arr_time + timedelta(minutes=delay)
                act_arr_str = act_arr.strftime("%H:%M")

                rec = models.TrainMovementHistory(
                    date=d,
                    train_number=train["number"],
                    train_name=train["name"],
                    section_id=sec_id,
                    scheduled_departure=sched_dep_str,
                    actual_departure=act_dep_str,
                    scheduled_arrival=sched_arr_str,
                    actual_arrival=act_arr_str,
                    delay_minutes=delay,
                    delay_cause=cause,
                    has_active_block=has_block
                )
                movement_records.append(rec)
                
                # Advance time for next section
                current_time = act_arr + timedelta(minutes=random.randint(5, 15))

    db.add_all(movement_records)
    db.commit()
    print(f"Seeded {len(movement_records)} train movement historical records.")

    # 3. Generate Asset Condition History
    asset_records = []
    for d in dates[::3]: # Every 3 days
        for sec_id in [1, 2, 3, 4, 5]:
            tqi = round(random.uniform(76.0, 94.5), 1)
            rail_wear = round(random.uniform(0.3, 2.4), 2)
            ohe_tension = round(random.uniform(980.0, 1025.0), 1)
            point_amps = round(random.uniform(2.1, 3.2), 2)
            
            status = "GOOD" if tqi > 80 and rail_wear < 2.0 else "WARNING"

            asset_rec = models.AssetConditionHistory(
                date=d,
                section_id=sec_id,
                asset_type="Track / P-Way & OHE",
                track_quality_index=tqi,
                rail_wear_mm=rail_wear,
                ohe_tension_kg=ohe_tension,
                point_machine_current_amps=point_amps,
                health_status=status
            )
            asset_records.append(asset_rec)

    db.add_all(asset_records)
    db.commit()
    print(f"Seeded {len(asset_records)} asset condition historical logs.")
    print("30-Day Indian Railways Historical Seeding Completed Successfully!")

if __name__ == "__main__":
    seed_history()
