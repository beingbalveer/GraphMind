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
from routers import auth, chat, curator, files, mastery, workspaces
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
        is_postgres = "postgresql" in str(engine.url)
        async with engine.begin() as conn:
            if is_postgres:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(Base.metadata.create_all)
            if is_postgres:
                await conn.execute(
                    text("ALTER TABLE nodes ADD COLUMN IF NOT EXISTS embedding vector(768);")
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_file_chunks_embedding_hnsw "
                        "ON workspace_file_chunks USING hnsw (embedding vector_cosine_ops);"
                    )
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_file_chunks_tsv_gin "
                        "ON workspace_file_chunks USING gin (to_tsvector('english', enriched_content));"
                    )
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_nodes_embedding_hnsw "
                        "ON nodes USING hnsw (embedding vector_cosine_ops);"
                    )
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_nodes_workspace_created "
                        "ON nodes (workspace_id, created_at);"
                    )
                )
                await conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS idx_concepts_workspace_created "
                        "ON workspace_concepts (workspace_id, created_at);"
                    )
                )
                # Auth & Multi-Tenancy Invariant Migration
                await conn.execute(
                    text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id VARCHAR(64);")
                )
                from services.auth_service import hash_password

                admin_hp = hash_password("admin123456")
                await conn.execute(
                    text(
                        "INSERT INTO users (id, email, hashed_password, full_name, provider, token_version, is_active, created_at, updated_at) "
                        "VALUES ('usr_default_admin', 'admin@graphmind.dev', :hp, 'Default Admin', 'local', 1, true, NOW(), NOW()) "
                        "ON CONFLICT (id) DO UPDATE SET "
                        "email = EXCLUDED.email, "
                        "hashed_password = EXCLUDED.hashed_password, "
                        "is_active = true;"
                    ),
                    {"hp": admin_hp},
                )
                await conn.execute(
                    text("UPDATE workspaces SET owner_id = 'usr_default_admin' WHERE owner_id IS NULL;")
                )
                await conn.execute(
                    text("CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces (owner_id);")
                )
                await conn.execute(
                    text(
                        "INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) "
                        "SELECT 'wsm_' || substr(md5(random()::text), 1, 12), id, 'usr_default_admin', 'owner', NOW() "
                        "FROM workspaces w "
                        "WHERE NOT EXISTS ("
                        "    SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.user_id = 'usr_default_admin'"
                        ") "
                        "ON CONFLICT DO NOTHING;"
                    )
                )
        logger.info("Database schema, pgvector extension, and performance indexes initialized successfully")
    except Exception as e:
        logger.warning("Database synchronization deferred or failed", error=str(e))

    yield
    logger.info("GraphMind API shutting down")


app = FastAPI(
    title="GraphMind API",
    description="AI-native Knowledge Workspace REST API",
    version="1.0.0",
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
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(workspaces.router, prefix="/api/v1")
app.include_router(mastery.router, prefix="/api/v1")
app.include_router(curator.router, prefix="/api/v1")
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
