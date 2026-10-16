"""add private public-snapshot copies

Revision ID: 20261016_0008
Revises: 20261015_0007
Create Date: 2026-10-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261016_0008"
down_revision: Union[str, None] = "20261015_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OWNED_TABLES = (
    "public_snapshot_copies",
    "public_snapshot_copy_topics",
)


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    existing = tables & set(OWNED_TABLES)
    if existing == set(OWNED_TABLES):
        return
    if existing:
        raise RuntimeError(
            "Public snapshot copy schema is partially initialized; reconcile before migrating"
        )

    op.create_table(
        "public_snapshot_copies",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("template_id", sa.String(length=64), nullable=False),
        sa.Column("snapshot_version", sa.String(length=32), nullable=False),
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            ondelete="CASCADE",
            name="fk_copy_workspace",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_copy_snapshot",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id"],
            ["roadmaps.id"],
            ondelete="CASCADE",
            name="fk_copy_roadmap",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id"],
            ["curriculum_revisions.id"],
            ondelete="CASCADE",
            name="fk_copy_revision",
        ),
        sa.PrimaryKeyConstraint("id"),
        # One copy per workspace/template: the durable idempotency guarantee.
        sa.UniqueConstraint("workspace_id", "template_id", name="uq_copy_workspace_template"),
        # A single idempotency key may never produce two different copies.
        sa.UniqueConstraint("workspace_id", "idempotency_key", name="uq_copy_workspace_key"),
        sa.UniqueConstraint("roadmap_id", name="uq_copy_roadmap"),
        sa.Index("idx_copy_template_version", "template_id", "snapshot_version"),
    )

    op.create_table(
        "public_snapshot_copy_topics",
        sa.Column("copy_id", sa.String(length=64), nullable=False),
        sa.Column("public_topic_id", sa.String(length=64), nullable=False),
        sa.Column("private_topic_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["copy_id"],
            ["public_snapshot_copies.id"],
            ondelete="CASCADE",
            name="fk_copy_topic_copy",
        ),
        sa.ForeignKeyConstraint(
            ["private_topic_id"],
            ["curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_copy_topic_private",
        ),
        sa.PrimaryKeyConstraint("copy_id", "public_topic_id"),
        sa.Index("idx_copy_topic_private", "copy_id", "private_topic_id"),
    )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "public_snapshot_copy_topics" in tables:
        op.drop_index("idx_copy_topic_private", table_name="public_snapshot_copy_topics")
        op.drop_table("public_snapshot_copy_topics")
    if "public_snapshot_copies" in tables:
        op.drop_index("idx_copy_template_version", table_name="public_snapshot_copies")
        op.drop_table("public_snapshot_copies")
