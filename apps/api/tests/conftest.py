from typing import AsyncGenerator

import pytest
from database import Base, get_engine
from sqlalchemy import text


@pytest.fixture(scope="session", autouse=True)
async def init_test_db() -> AsyncGenerator[None, None]:
    engine = get_engine()
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
            # Purge test workspaces while preserving the real primary workspace
            await conn.execute(text("DELETE FROM workspaces WHERE id != 'ws_52b50904606a';"))
            # Purge test users while preserving the default admin user
            await conn.execute(text("DELETE FROM users WHERE id != 'usr_default_admin';"))
