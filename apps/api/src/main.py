from datetime import datetime, timezone

import structlog
from config import get_settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from routers import chat

settings = get_settings()

# Initialize structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

app = FastAPI(
    title="GraphMind API",
    description="AI-native Knowledge Workspace REST API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(chat.router)


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    environment: str


@app.on_event("startup")
async def startup_event() -> None:
    logger.info(
        "GraphMind API starting up",
        environment=settings.ENVIRONMENT,
        port=settings.PORT,
        default_provider=settings.DEFAULT_PROVIDER,
    )


@app.get("/healthz", response_model=HealthCheckResponse, tags=["Health"])
async def health_check() -> HealthCheckResponse:
    """Health check endpoint for container monitoring and sanity checks."""
    return HealthCheckResponse(
        status="healthy",
        service="graphmind-api",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        environment=settings.ENVIRONMENT,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
