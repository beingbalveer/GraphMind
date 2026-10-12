"""add typed provenance for promoted curriculum topics

Revision ID: 20261013_0005
Revises: 20261007_0004
Create Date: 2026-10-13
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261013_0005"
down_revision: Union[str, None] = "20261007_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "curriculum_topic_origins" in tables:
        return
    op.create_table(
        "curriculum_topic_origins",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("creation_revision_id", sa.String(length=64), nullable=False),
        sa.Column("source_workspace_id", sa.String(length=64), nullable=True),
        sa.Column("source_owner_id", sa.String(length=64), nullable=True),
        sa.Column("source_private", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source_chat_id", sa.String(length=64), nullable=True),
        sa.Column("source_node_id", sa.String(length=64), nullable=True),
        sa.Column("source_title", sa.String(length=180), nullable=False),
        sa.Column("source_excerpt", sa.Text(), nullable=False),
        sa.UniqueConstraint(
            "creation_revision_id", "topic_id", name="uq_topic_origin_revision_topic"
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE", name="fk_topic_origin_roadmap"
        ),
        sa.ForeignKeyConstraint(
            ["creation_revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_topic_origin_revision",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "topic_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_topic_origin_identity",
        ),
        sa.ForeignKeyConstraint(
            ["source_workspace_id"], ["workspaces.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["source_owner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_chat_id"], ["nodes.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_node_id"], ["nodes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_topic_origin_revision", "curriculum_topic_origins", ["creation_revision_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_topic_origin_revision", table_name="curriculum_topic_origins")
    op.drop_table("curriculum_topic_origins")
