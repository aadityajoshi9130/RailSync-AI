import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///./railtwin.db"
)

# SQLite specific connect args
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_db():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check and seed stations
    if not db.query(models.Station).first():
        print("Seeding stations...")
        stations_data = [
            {"id": 1, "name": "Pune", "code": "PUNE"},
            {"id": 2, "name": "Lonavala", "code": "LNL"},
            {"id": 3, "name": "Karjat", "code": "KJT"},
            {"id": 4, "name": "Daund", "code": "DD"},
            {"id": 5, "name": "Solapur", "code": "SUR"},
            {"id": 6, "name": "Kurduvadi", "code": "KWV"},
        ]
        stations = []
        for s in stations_data:
            station = models.Station(id=s["id"], name=s["name"], code=s["code"])
            stations.append(station)
        db.add_all(stations)
        db.commit()

    # Check and seed sections
    if not db.query(models.RailwaySection).first():
        print("Seeding sections...")
        sections_data = [
            {"name": "Pune-Lonavala", "start_id": 1, "end_id": 2, "length": 64.0},
            {"name": "Lonavala-Karjat", "start_id": 2, "end_id": 3, "length": 28.0},
            {"name": "Pune-Daund", "start_id": 1, "end_id": 4, "length": 75.0},
            {"name": "Daund-Solapur", "start_id": 4, "end_id": 5, "length": 187.0},
            {"name": "Solapur-Kurduvadi", "start_id": 5, "end_id": 6, "length": 79.0},
            {"name": "Lonavala-Solapur", "start_id": 2, "end_id": 5, "length": 250.0},
        ]
        sections = []
        for sec in sections_data:
            section = models.RailwaySection(
                name=sec["name"],
                start_station_id=sec["start_id"],
                end_station_id=sec["end_id"],
                length_km=sec["length"]
            )
            sections.append(section)
        db.add_all(sections)
        db.commit()

    # Create Departments
    if not db.query(models.Department).first():
        print("Seeding departments...")
        departments_data = [
            {"name": "Engineering (Track)"},
            {"name": "OHE / Traction"},
            {"name": "S&T (Signalling & Telecom)"},
            {"name": "Operations"}
        ]
        for d in departments_data:
            dept = models.Department(name=d["name"])
            db.add(dept)
        db.commit()

    # Create Trains
    if not db.query(models.Train).first():
        print("Seeding trains...")
        trains_data = [
            {"name": "12124 Deccan Queen", "section_id": 1, "position": 0.35, "status": models.TrainStatusEnum.RUNNING},
            {"name": "12028 Shatabdi Exp", "section_id": 2, "position": 0.65, "status": models.TrainStatusEnum.RUNNING},
            {"name": "11019 Konark Exp", "section_id": 4, "position": 0.20, "status": models.TrainStatusEnum.RUNNING},
            {"name": "12157 Hutatma Exp", "section_id": 5, "position": 0.50, "status": models.TrainStatusEnum.RUNNING},
        ]
        for t in trains_data:
            train = models.Train(
                name=t["name"],
                current_section_id=t["section_id"],
                position=t["position"],
                status=t["status"]
            )
            db.add(train)
        db.commit()

    # Create Initial Maintenance Tasks
    if not db.query(models.MaintenanceTask).first():
        print("Seeding maintenance tasks...")
        tasks_data = [
            {"department_id": 1, "section_id": 1, "description": "Track tamping & ballast cleaning km 112-116", "priority": models.PriorityEnum.HIGH, "duration_minutes": 180},
            {"department_id": 2, "section_id": 1, "description": "OHE contact wire inspection & bracket renewal", "priority": models.PriorityEnum.HIGH, "duration_minutes": 150},
            {"department_id": 3, "section_id": 1, "description": "Axle counter calibration & point machine test", "priority": models.PriorityEnum.MEDIUM, "duration_minutes": 120},
            {"department_id": 1, "section_id": 4, "description": "Ultrasonic rail flaw detection (USFD)", "priority": models.PriorityEnum.MEDIUM, "duration_minutes": 120},
        ]
        for task in tasks_data:
            m = models.MaintenanceTask(
                department_id=task["department_id"],
                section_id=task["section_id"],
                description=task["description"],
                priority=task["priority"],
                duration_minutes=task["duration_minutes"]
            )
            db.add(m)
        db.commit()

    print("Seeding completed.")

if __name__ == "__main__":
    seed_db()

