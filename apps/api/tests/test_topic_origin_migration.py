"""Regression coverage for fresh and partially-created topic-origin tables."""

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
    / "20261013_0005_add_curriculum_topic_origins.py"
)


def _migration() -> ModuleType:
    spec = importlib.util.spec_from_file_location("topic_origin_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


async def _run_upgrade(connection: AsyncConnection) -> None:
    migration = _migration()

    def run(sync_connection: Connection) -> None:
        with Operations.context(MigrationContext.configure(sync_connection)):
            migration.upgrade()

    await connection.run_sync(run)


async def _run_downgrade(connection: AsyncConnection) -> None:
    migration = _migration()

    def run(sync_connection: Connection) -> None:
        with Operations.context(MigrationContext.configure(sync_connection)):
            migration.downgrade()

    await connection.run_sync(run)


async def _migration_schema() -> tuple[AsyncConnection, AsyncTransaction]:
    engine = get_engine()
    connection = await engine.connect()
    transaction = await connection.begin()
    schema = f"origin_migration_{uuid.uuid4().hex}"
    await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    await connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    await connection.execute(text("CREATE TABLE users (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE workspaces (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE nodes (id varchar(64) PRIMARY KEY)"))
    await connection.execute(text("CREATE TABLE roadmaps (id varchar(64) PRIMARY KEY)"))
    await connection.execute(
        text(
            "CREATE TABLE curriculum_revisions ("
            "id varchar(64) NOT NULL, roadmap_id varchar(64) NOT NULL, "
            "UNIQUE (id, roadmap_id))"
        )
    )
    await connection.execute(
        text(
            "CREATE TABLE curriculum_items ("
            "roadmap_id varchar(64) NOT NULL, id varchar(64) NOT NULL, "
            "UNIQUE (roadmap_id, id))"
        )
    )
    await connection.execute(
        text("CREATE TABLE topic_chats (chat_id varchar(64) PRIMARY KEY, owner_id varchar(64) NOT NULL)")
    )
    await connection.execute(text("INSERT INTO users VALUES ('owner-a')"))
    await connection.execute(text("INSERT INTO workspaces VALUES ('workspace-a')"))
    await connection.execute(
        text("INSERT INTO nodes VALUES ('source-active'), ('source-general')")
    )
    await connection.execute(text("INSERT INTO roadmaps VALUES ('roadmap-a')"))
    await connection.execute(
        text("INSERT INTO curriculum_revisions VALUES ('revision-a', 'roadmap-a')")
    )
    await connection.execute(
        text(
            "INSERT INTO curriculum_items VALUES "
            "('roadmap-a', 'topic-active'), ('roadmap-a', 'topic-general'), "
            "('roadmap-a', 'topic-unavailable')"
        )
    )
    await connection.execute(
        text("INSERT INTO topic_chats VALUES ('source-active', 'owner-a')")
    )
    return connection, transaction


async def _create_partial_table(
    connection: AsyncConnection, *, has_source_private: bool
) -> None:
    source_private = ", source_private boolean" if has_source_private else ""
    await connection.execute(
        text(
            "CREATE TABLE curriculum_topic_origins ("
            "id varchar(64) PRIMARY KEY, roadmap_id varchar(64) NOT NULL, "
            "topic_id varchar(64) NOT NULL, creation_revision_id varchar(64) NOT NULL, "
            "source_workspace_id varchar(64), source_chat_id varchar(64), "
            "source_node_id varchar(64), source_title varchar(180) NOT NULL, "
            f"source_excerpt text NOT NULL{source_private}, "
            "FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE, "
            "FOREIGN KEY (source_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL, "
            "FOREIGN KEY (source_chat_id) REFERENCES nodes(id) ON DELETE SET NULL, "
            "FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE SET NULL, "
            "FOREIGN KEY (creation_revision_id, roadmap_id) "
            "REFERENCES curriculum_revisions(id, roadmap_id) ON DELETE CASCADE, "
            "FOREIGN KEY (roadmap_id, topic_id) "
            "REFERENCES curriculum_items(roadmap_id, id) ON DELETE CASCADE)"
        )
    )


@pytest.mark.asyncio
async def test_fresh_topic_origin_migration_is_complete_and_idempotent() -> None:
    connection, transaction = await _migration_schema()
    try:
        await _run_upgrade(connection)
        await _run_upgrade(connection)
        columns = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = current_schema() "
                    "AND table_name = 'curriculum_topic_origins'"
                )
            )
        }
        assert {"source_owner_id", "source_private"} <= columns
        constraints = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT conname FROM pg_constraint "
                    "WHERE conrelid = 'curriculum_topic_origins'::regclass"
                )
            )
        }
        assert "fk_topic_origin_source_owner" in constraints
        assert "uq_topic_origin_revision_topic" in constraints
        indexes = {
            row[0]
            for row in await connection.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = current_schema() "
                    "AND tablename = 'curriculum_topic_origins'"
                )
            )
        }
        assert "idx_topic_origin_revision" in indexes
        await connection.execute(
            text(
                "INSERT INTO curriculum_topic_origins "
                "(id, roadmap_id, topic_id, creation_revision_id, source_title, source_excerpt) "
                "VALUES ('fresh-origin', 'roadmap-a', 'topic-general', 'revision-a', 'title', 'excerpt')"
            )
        )
        assert (
            await connection.execute(
                text("SELECT source_private FROM curriculum_topic_origins WHERE id='fresh-origin'")
            )
        ).scalar_one() is False
        assert (
            await connection.execute(
                text("SELECT source_owner_id FROM curriculum_topic_origins WHERE id='fresh-origin'")
            )
        ).scalar_one_or_none() is None
    finally:
        await transaction.rollback()
        await connection.close()


@pytest.mark.asyncio
async def test_legacy_partial_table_backfills_owner_and_keeps_unknown_sources_private() -> None:
    connection, transaction = await _migration_schema()
    try:
        await _create_partial_table(connection, has_source_private=False)
        await connection.execute(
            text(
                "INSERT INTO curriculum_topic_origins "
                "(id,roadmap_id,topic_id,creation_revision_id,source_workspace_id,source_chat_id,source_node_id,source_title,source_excerpt) "
                "VALUES ('legacy-active','roadmap-a','topic-active','revision-a','workspace-a','source-active','source-active','private','excerpt'), "
                "('legacy-deleted','roadmap-a','topic-unavailable','revision-a','workspace-a',NULL,NULL,'deleted private','excerpt')"
            )
        )
        await _run_upgrade(connection)
        await _run_upgrade(connection)
        rows = [
            tuple(row)
            for row in await connection.execute(
                text(
                    "SELECT id, source_owner_id, source_private "
                    "FROM curriculum_topic_origins ORDER BY id"
                )
            )
        ]
        assert rows == [
            ("legacy-active", "owner-a", True),
            ("legacy-deleted", None, True),
        ]
    finally:
        await transaction.rollback()
        await connection.close()


@pytest.mark.asyncio
async def test_partial_table_preserves_general_private_and_unavailable_visibility() -> None:
    connection, transaction = await _migration_schema()
    try:
        await _create_partial_table(connection, has_source_private=True)
        await connection.execute(
            text(
                "INSERT INTO curriculum_topic_origins "
                "(id,roadmap_id,topic_id,creation_revision_id,source_workspace_id,source_chat_id,source_node_id,source_title,source_excerpt,source_private) "
                "VALUES ('general','roadmap-a','topic-general','revision-a','workspace-a',NULL,'source-general','general','excerpt',false), "
                "('private','roadmap-a','topic-active','revision-a','workspace-a','source-active','source-active','private','excerpt',true), "
                "('unavailable','roadmap-a','topic-unavailable','revision-a',NULL,NULL,NULL,'deleted','excerpt',true)"
            )
        )
        await _run_upgrade(connection)
        await _run_upgrade(connection)
        rows = [
            tuple(row)
            for row in await connection.execute(
                text(
                    "SELECT id, source_owner_id, source_private "
                    "FROM curriculum_topic_origins ORDER BY id"
                )
            )
        ]
        assert rows == [
            ("general", None, False),
            ("private", "owner-a", True),
            ("unavailable", None, True),
        ]
    finally:
        await transaction.rollback()
        await connection.close()


@pytest.mark.asyncio
async def test_downgrade_handles_equivalent_legacy_revision_index_name() -> None:
    connection, transaction = await _migration_schema()
    try:
        await _create_partial_table(connection, has_source_private=True)
        await connection.execute(
            text(
                "CREATE INDEX legacy_topic_origin_revision_index "
                "ON curriculum_topic_origins (creation_revision_id)"
            )
        )
        await _run_upgrade(connection)
        await _run_downgrade(connection)
        table_exists = (
            await connection.execute(
                text(
                    "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = current_schema() "
                    "AND table_name = 'curriculum_topic_origins')"
                )
            )
        ).scalar_one()
        assert table_exists is False
    finally:
        await transaction.rollback()
        await connection.close()
