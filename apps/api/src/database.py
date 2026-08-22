import sys
from typing import AsyncGenerator, Optional

import structlog
from config import get_settings
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

logger = structlog.get_logger()
settings = get_settings()


class Base(DeclarativeBase):
    """
    Base declarative class for all SQLAlchemy ORM models in GraphMind.
    """

    pass


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_db_url() -> str:
    """
    Resolve and normalize the PostgreSQL connection string for asyncpg.
    """
    raw_url = settings.DATABASE_URL or "postgresql+asyncpg://balveerd:1234@localhost:5432/graphmind"
    if raw_url.startswith("postgresql://"):
        return raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return raw_url


def get_engine() -> AsyncEngine:
    """
    Get or create the singleton async SQLAlchemy engine.
    """
    global _engine
    if _engine is None:
        db_url = get_db_url()
        is_test = "pytest" in sys.modules or settings.ENVIRONMENT == "test"
        if is_test:
            _engine = create_async_engine(
                db_url,
                echo=False,
                poolclass=NullPool,
            )
        else:
            logger.info("Initializing SQLAlchemy async database engine", url=db_url.split("@")[-1])
            _engine = create_async_engine(
                db_url,
                echo=False,
                pool_pre_ping=True,
                pool_size=10,
                max_overflow=20,
            )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get or create the singleton async session factory.
    """
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async database session per request.
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error("Database transaction rolled back due to error", error=str(e))
            raise
        finally:
            await session.close()
