"""add immutable public snapshots

Revision ID: 20261015_0007
Revises: 20261015_0006
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261015_0007"
down_revision: Union[str, None] = "20261015_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OWNED_TABLES = (
    "public_snapshots",
    "public_snapshot_phases",
    "public_snapshot_topics",
    "public_snapshot_sources",
    "public_snapshot_topic_sources",
    "public_snapshot_origins",
)


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    existing = tables & set(OWNED_TABLES)
    if existing == set(OWNED_TABLES):
        return
    if existing:
        raise RuntimeError(
            "Public snapshot schema is partially initialized; reconcile before migrating"
        )

    op.create_table(
        "public_snapshots",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("template_id", sa.String(length=64), nullable=False),
        sa.Column("snapshot_version", sa.String(length=32), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("level", sa.String(length=16), nullable=False),
        sa.Column("estimated_weeks", sa.Integer(), nullable=False),
        sa.Column("hours_per_week", sa.Float(), nullable=False),
        sa.Column("topic_count", sa.Integer(), nullable=False),
        sa.Column("outcomes", sa.JSON(), nullable=False),
        sa.Column("prerequisites", sa.JSON(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unpublished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('published','unpublished')", name="ck_public_snapshot_status"
        ),
        sa.CheckConstraint(
            "level IN ('beginner','intermediate','advanced')", name="ck_public_snapshot_level"
        ),
        sa.CheckConstraint("estimated_weeks BETWEEN 1 AND 104", name="ck_public_snapshot_weeks"),
        sa.CheckConstraint(
            "hours_per_week > 0 AND hours_per_week <= 80", name="ck_public_snapshot_hours"
        ),
        sa.CheckConstraint("topic_count > 0", name="ck_public_snapshot_topic_count"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("template_id", "snapshot_version", name="uq_public_snapshot_version"),
        # A slug identifies a roadmap template, so versions of one template
        # share it; this is a lookup index, and cross-template slug uniqueness
        # is enforced by the publication service.
        sa.Index("ix_public_snapshots_slug", "slug"),
    )
    op.create_index(
        "idx_public_snapshot_catalog",
        "public_snapshots",
        ["status", "category", "level"],
        unique=False,
    )
    op.create_index(
        "ix_public_snapshots_template_id", "public_snapshots", ["template_id"], unique=False
    )

    op.create_table(
        "public_snapshot_phases",
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("phase_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=16), nullable=False),
        sa.CheckConstraint("path IN ('core','further')", name="ck_public_phase_path"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_phase_snapshot",
        ),
        sa.PrimaryKeyConstraint("snapshot_id", "phase_id"),
    )
    op.create_index(
        "idx_public_phase_order",
        "public_snapshot_phases",
        ["snapshot_id", "position"],
        unique=False,
    )

    op.create_table(
        "public_snapshot_topics",
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("phase_id", sa.String(length=64), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("brief", sa.Text(), nullable=False),
        sa.Column("objectives", sa.JSON(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=True),
        sa.Column("exercise", sa.Text(), nullable=True),
        sa.Column("format", sa.String(length=16), nullable=True),
        sa.Column("estimate_minutes", sa.Integer(), nullable=True),
        sa.Column("path", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("prerequisites", sa.JSON(), nullable=False),
        sa.CheckConstraint("path IN ('core','further')", name="ck_public_topic_path"),
        sa.CheckConstraint(
            "format IS NULL OR format IN ('concepts','practice','project')",
            name="ck_public_topic_format",
        ),
        sa.CheckConstraint(
            "estimate_minutes IS NULL OR estimate_minutes > 0", name="ck_public_topic_effort"
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_topic_snapshot",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "phase_id"],
            ["public_snapshot_phases.snapshot_id", "public_snapshot_phases.phase_id"],
            ondelete="CASCADE",
            name="fk_public_topic_phase",
        ),
        sa.PrimaryKeyConstraint("snapshot_id", "topic_id"),
        sa.UniqueConstraint("snapshot_id", "slug", name="uq_public_topic_slug"),
    )
    op.create_index(
        "idx_public_topic_order",
        "public_snapshot_topics",
        ["snapshot_id", "position"],
        unique=False,
    )
    op.create_index(
        "idx_public_topic_phase",
        "public_snapshot_topics",
        ["snapshot_id", "phase_id"],
        unique=False,
    )

    op.create_table(
        "public_snapshot_sources",
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=1000), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("locator", sa.String(length=1000), nullable=True),
        sa.Column("kind", sa.String(length=100), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_source_snapshot",
        ),
        sa.PrimaryKeyConstraint("snapshot_id", "source_id"),
    )
    op.create_index(
        "idx_public_source_snapshot", "public_snapshot_sources", ["snapshot_id"], unique=False
    )

    op.create_table(
        "public_snapshot_topic_sources",
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "topic_id"],
            ["public_snapshot_topics.snapshot_id", "public_snapshot_topics.topic_id"],
            ondelete="CASCADE",
            name="fk_public_topic_source_topic",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id", "source_id"],
            ["public_snapshot_sources.snapshot_id", "public_snapshot_sources.source_id"],
            ondelete="CASCADE",
            name="fk_public_topic_source_source",
        ),
        sa.PrimaryKeyConstraint("snapshot_id", "topic_id", "source_id"),
    )
    op.create_index(
        "idx_public_topic_source_topic",
        "public_snapshot_topic_sources",
        ["snapshot_id", "topic_id"],
        unique=False,
    )

    op.create_table(
        "public_snapshot_origins",
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("source_workspace_id", sa.String(length=64), nullable=True),
        sa.Column("source_roadmap_id", sa.String(length=64), nullable=True),
        sa.Column("source_revision_id", sa.String(length=64), nullable=True),
        sa.Column("published_by", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_origin_snapshot",
        ),
        sa.ForeignKeyConstraint(
            ["source_workspace_id"],
            ["workspaces.id"],
            ondelete="SET NULL",
            name="fk_public_origin_workspace",
        ),
        sa.ForeignKeyConstraint(
            ["source_roadmap_id"],
            ["roadmaps.id"],
            ondelete="SET NULL",
            name="fk_public_origin_roadmap",
        ),
        sa.ForeignKeyConstraint(
            ["source_revision_id"],
            ["curriculum_revisions.id"],
            ondelete="SET NULL",
            name="fk_public_origin_revision",
        ),
        sa.ForeignKeyConstraint(
            ["published_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_public_origin_publisher",
        ),
        sa.PrimaryKeyConstraint("snapshot_id"),
    )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "public_snapshot_origins" in tables:
        op.drop_table("public_snapshot_origins")
    if "public_snapshot_topic_sources" in tables:
        op.drop_index("idx_public_topic_source_topic", table_name="public_snapshot_topic_sources")
        op.drop_table("public_snapshot_topic_sources")
    if "public_snapshot_sources" in tables:
        op.drop_index("idx_public_source_snapshot", table_name="public_snapshot_sources")
        op.drop_table("public_snapshot_sources")
    if "public_snapshot_topics" in tables:
        op.drop_index("idx_public_topic_phase", table_name="public_snapshot_topics")
        op.drop_index("idx_public_topic_order", table_name="public_snapshot_topics")
        op.drop_table("public_snapshot_topics")
    if "public_snapshot_phases" in tables:
        op.drop_index("idx_public_phase_order", table_name="public_snapshot_phases")
        op.drop_table("public_snapshot_phases")
    if "public_snapshots" in tables:
        op.drop_index("ix_public_snapshots_slug", table_name="public_snapshots")
        op.drop_index("ix_public_snapshots_template_id", table_name="public_snapshots")
        op.drop_index("idx_public_snapshot_catalog", table_name="public_snapshots")
        op.drop_table("public_snapshots")
