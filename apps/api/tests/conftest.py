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
    yield
