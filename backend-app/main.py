from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger
import sys

from core.config import settings
from core.database import engine, Base
import models.domain
from api.routes import projects, auth, users, survey_reports

from sqlalchemy import text

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# Run simple ALTER queries to add columns if they don't exist in PostgreSQL
with engine.connect() as conn:
    # Migration for tasks table
    try:
        with conn.begin():
            conn.execute(text("ALTER TABLE tasks RENAME COLUMN crew_needed TO planned_crew"))
    except Exception:
        pass

    try:
        with conn.begin():
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_crew INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_crew INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1"))
    except Exception as e:
        logger.error(f"Error updating tasks table schema: {e}")
        
    # Migration for subtasks table
    try:
        with conn.begin():
            conn.execute(text("ALTER TABLE subtasks RENAME COLUMN crew_needed TO planned_crew"))
    except Exception:
        pass

    try:
        with conn.begin():
            conn.execute(text("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS planned_crew INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS actual_crew INTEGER DEFAULT 1"))
            conn.execute(text("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1"))
    except Exception as e:
        logger.error(f"Error updating subtasks table schema: {e}")



# Configure logger
logger.remove()
logger.add(sys.stdout, format="{time} {level} {message}", level="INFO")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)


# 1. Custom Middleware to preserve HTTPS scheme behind Azure App Service proxy
class AzureHTTPSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.headers.get("x-forwarded-proto") == "https":
            request.scope["scheme"] = "https"
        return await call_next(request)
app.add_middleware(AzureHTTPSMiddleware)


# 2. CORS Middleware for Angular Frontend (evaluated after AzureHTTPSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "https://ranjeev20.github.io"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/health/ready")
def health_ready():
    return {"status": "ready"}

# Include routers
app.include_router(projects.router, prefix=f"{settings.API_V1_STR}/projects", tags=["projects"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(survey_reports.router, prefix=f"{settings.API_V1_STR}/survey-reports", tags=["survey-reports"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
