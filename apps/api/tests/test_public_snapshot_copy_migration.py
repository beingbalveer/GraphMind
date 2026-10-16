"""Migration round-trip coverage for private public-snapshot copies (LSI-028)."""

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
    Path(__file__).parents[1]
    / "alembic"
    / "versions"
    / "20261016_0008_add_public_snapshot_copies.py"
)

OWNED_TABLES = (
    "public_snapshot_copies",
    "public_snapshot_copy_topics",
)


def _migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("public_snapshot_copy_migration", MIGRATION_PATH)
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
    schema = f"public_snapshot_copy_migration_{uuid.uuid4().hex}"
    await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    # Minimal private prerequisites referenced by the copy tables.
    await connection.execute(text("CREATE TABLE public_snapshots (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE workspaces (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE roadmaps (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE curriculum_revisions (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE curriculum_items (id varchar(64) PRIMARY KEY)"))
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


def test_migration_links_to_the_linear_head() -> None:
    migration = _migration()
    assert migration.revision == "20261016_0008"
    assert migration.down_revision == "20261015_0007"


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
                    "WHERE conrelid = 'public_snapshot_copies'::regclass"
                )
            )
        }
        assert {
            "uq_copy_workspace_template",
            "uq_copy_workspace_key",
            "uq_copy_roadmap",
            "fk_copy_workspace",
            "fk_copy_snapshot",
            "fk_copy_roadmap",
            "fk_copy_revision",
        } <= constraints

        indexes = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = current_schema() AND tablename = 'public_snapshot_copies'"
                )
            )
        }
        assert "idx_copy_template_version" in indexes

        # A copy and its topic map are storable with their foreign keys.
        await connection.execute(text("INSERT INTO public_snapshots (id) VALUES ('pub-1')"))
        await connection.execute(text("INSERT INTO workspaces (id) VALUES ('ws-1')"))
        await connection.execute(text("INSERT INTO roadmaps (id) VALUES ('roadmap-1')"))
        await connection.execute(text("INSERT INTO curriculum_revisions (id) VALUES ('rev-1')"))
        await connection.execute(text("INSERT INTO curriculum_items (id) VALUES ('item-1')"))
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_copies "
                "(id, workspace_id, template_id, snapshot_version, snapshot_id, roadmap_id, "
                "revision_id, idempotency_key, created_at, updated_at) VALUES "
                "('copy-1','ws-1','template-a','v1','pub-1','roadmap-1','rev-1','key-1', "
                "NOW(), NOW())"
            )
        )
        await connection.execute(
            text(
                "INSERT INTO public_snapshot_copy_topics "
                "(copy_id, public_topic_id, private_topic_id, position) "
                "VALUES ('copy-1','pub_topic_1','item-1',0)"
            )
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
