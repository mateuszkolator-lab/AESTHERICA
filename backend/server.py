from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# Load environment variables from .env file
load_dotenv()

# Import routers
from routers.auth import router as auth_router, init_default_admin, migrate_users_location_fields
from routers.patients import router as patients_router
from routers.surgery_slots import router as surgery_slots_router
from routers.settings import router as settings_router
from routers.stats import router as stats_router
from routers.utils import router as utils_router
from routers.calendar import router as calendar_router
from routers.rhinoplanner import router as rhinoplanner_router
from routers.users import router as users_router
from routers.audit import router as audit_router
from routers.controls import router as controls_router
from routers.backup import router as backup_router, backup_scheduler
from routers.surveys import router as surveys_router, seed_survey_templates
import asyncio

# Import database
from models.database import get_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_default_admin()
    await migrate_users_location_fields()
    await seed_survey_templates()
    scheduler_task = asyncio.create_task(backup_scheduler())
    yield
    # Shutdown
    scheduler_task.cancel()
    get_client().close()

app = FastAPI(
    title="AestheticaMD API",
    description="Patient Management System for Facial Plastic Surgery",
    version="2.0.0",
    lifespan=lifespan
)

# API Router with /api prefix
api_router = FastAPI()

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(patients_router)
api_router.include_router(surgery_slots_router)
api_router.include_router(settings_router)
api_router.include_router(stats_router)
api_router.include_router(utils_router)
api_router.include_router(calendar_router)
api_router.include_router(rhinoplanner_router)
api_router.include_router(audit_router)
api_router.include_router(controls_router)
api_router.include_router(backup_router)
api_router.include_router(surveys_router)

# Mount API router under /api prefix
app.mount("/api", api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "AestheticaMD API", "version": "2.0.0", "docs": "/api/docs"}
