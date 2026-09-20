import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, SessionLocal
from . import models
from .api import network, trains, maintenance, blocks, analytics, operational
from .services.operational_clock import clock_worker

# Create DB tables
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start central authoritative operational clock & simulation worker
    clock_task = asyncio.create_task(clock_worker())
    yield
    # Shutdown: Cancel operational clock worker
    clock_task.cancel()
    try:
        await clock_task
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
app.include_router(operational.router)




@app.get("/")
def read_root():
    return {"message": "Welcome to RailSync Ai API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

