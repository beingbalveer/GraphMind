"""Migration round-trip coverage for the immutable public snapshot schema (LSI-025)."""

import importlib.util
import uuid
from pathlib import Path
from types import ModuleType

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from database import get_engine
from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncTransaction

MIGRATION_PATH = (
    Path(__file__).parents[1] / "alembic" / "versions" / "20261015_0007_add_public_snapshots.py"
)

OWNED_TABLES = (
    "public_snapshots",
    "public_snapshot_phases",
    "public_snapshot_topics",
    "public_snapshot_sources",
    "public_snapshot_topic_sources",
    "public_snapshot_origins",
)


def _migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("public_snapshot_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


async def _run(connection: AsyncConnection, *, direction: str) -> None:
    migration = _migration()

    def run(sync_connection: Connection) -> None:
        with Operations.context(MigrationContext.configure(sync_connection)):
            if direction == "upgrade":
                migration.upgrade()
            else:
                migration.downgrade()

    await connection.run_sync(run)


async def _migration_schema() -> tuple[AsyncConnection, AsyncTransaction]:
    engine = get_engine()
    connection = await engine.connect()
    transaction = await connection.begin()
    schema = f"public_snapshot_migration_{uuid.uuid4().hex}"
    await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    # Minimal private prerequisites referenced by public_snapshot_origins.
    await connection.execute(text("CREATE TABLE users (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE workspaces (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE roadmaps (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE curriculum_revisions (id varchar(64) PRIMARY KEY)"))
    return connection, transaction


async def _table_names(connection: AsyncConnection) -> set[str]:
    return {
        row[0]
        for row in await connection.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = current_schema()"
            )
        )
    }


async def test_migration_links_to_the_linear_head() -> None:
    migration = _migration()
    assert migration.revision == "20261015_0007"
    assert migration.down_revision == "20261015_0006"


@pytest.mark.asyncio
async def test_fresh_migration_is_complete_idempotent_and_reversible() -> None:
    connection, transaction = await _migration_schema()
    try:
        await _run(connection, direction="upgrade")
        await _run(connection, direction="upgrade")  # Idempotent on an existing schema.

        assert set(OWNED_TABLES) <= await _table_names(connection)

        constraints = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT conname FROM pg_constraint "
                    "WHERE conrelid = 'public_snapshots'::regclass"
                )
            )
        }
        assert {
            "uq_public_snapshot_version",
            "ck_public_snapshot_status",
            "ck_public_snapshot_level",
        } <= constraints

        indexes = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = current_schema() AND tablename = 'public_snapshots'"
                )
            )
        }
        assert "idx_public_snapshot_catalog" in indexes
        assert "ix_public_snapshots_template_id" in indexes
        assert "ix_public_snapshots_slug" in indexes

        # The frozen rows and their relationships are storable together.
        await connection.execute(
            text(
                "INSERT INTO public_snapshots "
                "(id, template_id, snapshot_version, slug, title, summary, category, level, "
                "estimated_weeks, hours_per_week, topic_count, outcomes, prerequisites, tags, "
                "content_hash, status, published_at, created_at, updated_at) VALUES "
                "('pub-1','roadmap-a','v1','roadmap-a','Title','Summary','general','beginner', "
                "2, 6, 1, '[]'::json, '[]'::json, '[]'::json, 'hash', 'published', "
                "NOW(), NOW(), NOW())"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_phases (snapshot_id, phase_id, title, position, path) "
                "VALUES ('pub-1','ph-1','Phase',0,'core')"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_topics "
                "(snapshot_id, topic_id, phase_id, slug, title, brief, objectives, "
                "content_markdown, exercise, format, estimate_minutes, path, position, prerequisites) "
                "VALUES ('pub-1','topic-1','ph-1','topic-1','Topic','Brief','[]'::json, "
                "NULL, NULL, NULL, NULL, 'core', 0, '[]'::json)"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_sources "
                "(snapshot_id, source_id, title, url, locator, kind, position) "
                "VALUES ('pub-1','src-1','Source','https://example.com','section:1','article',0)"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_topic_sources "
                "(snapshot_id, topic_id, source_id, position) VALUES ('pub-1','topic-1','src-1',0)"
            )
        )
        await connection.execute(
            text("INSERT INTO public_snapshot_origins (snapshot_id) VALUES ('pub-1')")
        )
        counts = {
            table: (await connection.execute(text(f'SELECT count(*) FROM "{table}"'))).scalar_one()
            for table in OWNED_TABLES
        }
        assert counts == {table: 1 for table in OWNED_TABLES}

        await _run(connection, direction="downgrade")
        remaining = await _table_names(connection)
        assert not (set(OWNED_TABLES) & remaining)
    finally:
        await transaction.rollback()
        await connection.close()
