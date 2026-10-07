import os
from typing import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def assert_test_database_url(url: str) -> None:
    """Reject implicit/live database configuration before importing the app."""
    message = "Backend tests require ENVIRONMENT=test and an isolated *_test database"
    try:
        parsed = make_url(url)
    except ArgumentError:
        raise RuntimeError(message) from None
    if (
        os.environ.get("ENVIRONMENT") != "test"
        or parsed.drivername not in {"postgresql", "postgresql+asyncpg"}
        or not (parsed.database or "").endswith("_test")
    ):
        raise RuntimeError(message)


assert_test_database_url(os.environ.get("DATABASE_URL", "postgresql:///graphmind"))

# These imports must follow the guard: settings may otherwise use the live DB.
import models  # noqa: E402, F401
from database import Base, get_db_url, get_engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def init_test_db() -> AsyncGenerator[None, None]:
    assert_test_database_url(get_db_url())
    engine = get_engine()
    assert_test_database_url(engine.url.render_as_string(hide_password=False))
    is_postgres = "postgresql" in str(engine.url)
    async with engine.begin() as conn:
        if is_postgres:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
        if is_postgres:
            await conn.execute(
                text(
                    "INSERT INTO users (id, email, hashed_password, full_name, provider, token_version, is_active, created_at, updated_at) "
                    "VALUES ('usr_default_admin', 'admin@graphmind.dev', '$2b$12$HSNk1SzzUFFI.tQ/Khb9Ke38ugvdfZ8Z86I58ySKqJk7pI1eliBkW', 'Default Admin', 'local', 1, true, NOW(), NOW()) "
                    "ON CONFLICT (id) DO UPDATE SET "
                    "email = EXCLUDED.email, "
                    "hashed_password = EXCLUDED.hashed_password, "
                    "is_active = true;"
                )
            )
    try:
        yield
    finally:
        async with engine.begin() as conn:
            # This connection was checked against the explicit test DB guard.
            await conn.execute(text("DELETE FROM workspaces;"))
            # Purge test users while preserving the default admin user
            await conn.execute(text("DELETE FROM users WHERE id != 'usr_default_admin';"))
