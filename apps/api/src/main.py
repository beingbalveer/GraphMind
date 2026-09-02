from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

import structlog
from config import get_settings
from database import Base, get_engine
from errors import (
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from middleware import RequestTracingMiddleware
from pydantic import BaseModel
from routers import chat, files, workspaces
from starlette.exceptions import HTTPException as StarletteHTTPException

settings = get_settings()

# Initialize structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """
    Application startup and graceful shutdown lifecycle manager.
    """
    logger.info(
        "GraphMind API starting up",
        environment=settings.ENVIRONMENT,
        port=settings.PORT,
        default_provider=settings.DEFAULT_PROVIDER,
    )
    # Ensure database schema tables exist
    try:
        from sqlalchemy import text

        engine = get_engine()
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text("ALTER TABLE nodes ADD COLUMN IF NOT EXISTS embedding vector(768);")
            )
        logger.info("Database schema and pgvector extension initialized successfully")
    except Exception as e:
        logger.warning("Database synchronization deferred or failed", error=str(e))

    yield
    logger.info("GraphMind API shutting down")


app = FastAPI(
    title="GraphMind API",
    description="AI-native Knowledge Workspace REST API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Request Tracing & Correlation Middleware
app.add_middleware(RequestTracingMiddleware)

# Enable CORS for frontend web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standardized Exception Handlers
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Register API Routers
app.include_router(chat.router)
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(files.router)


class HealthCheckResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    environment: str


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
