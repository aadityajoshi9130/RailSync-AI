import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, SessionLocal
from . import models
from .api import network, trains, maintenance, blocks, analytics

# Create DB tables
models.Base.metadata.create_all(bind=engine)




async def train_simulation_loop():
    """Background loop that continuously moves running trains across the railway network."""
    while True:
        try:
            await asyncio.sleep(2.0)
            db = SessionLocal()
            try:
                running_trains = db.query(models.Train).filter(models.Train.status == models.TrainStatusEnum.RUNNING).all()
                sections = {s.id: s for s in db.query(models.RailwaySection).all()}
                
                for train in running_trains:
                    train.position = round(train.position + 0.04, 3)
                    if train.position >= 1.0:
                        cur_sec = sections.get(train.current_section_id)
                        if cur_sec:
                            next_sec = next(
                                (s for s in sections.values() if s.start_station_id == cur_sec.end_station_id and s.id != cur_sec.id),
                                None
                            )
                            if next_sec:
                                train.current_section_id = next_sec.id
                                train.position = 0.0
                            else:
                                # Loop back to beginning
                                train.position = 0.0
                        else:
                            train.position = 0.0
                db.commit()
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Simulation loop error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start background simulation loop
    sim_task = asyncio.create_task(train_simulation_loop())
    yield
    # Shutdown: Cancel background simulation loop
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="RailSync Ai API",
    description="Backend API for the RailSync Ai Railway Block Planning Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(network.router)
app.include_router(trains.router)
app.include_router(maintenance.router)
app.include_router(blocks.router)
app.include_router(analytics.router)




@app.get("/")
def read_root():
    return {"message": "Welcome to RailSync Ai API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

