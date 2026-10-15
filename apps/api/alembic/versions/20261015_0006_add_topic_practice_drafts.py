"""add topic practice drafts table

Revision ID: 20261015_0006
Revises: 20261013_0005
Create Date: 2026-10-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261015_0006"
down_revision: Union[str, None] = "20261013_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "topic_practice_drafts" not in tables:
        op.create_table(
            "topic_practice_drafts",
            sa.Column("roadmap_id", sa.String(length=64), nullable=False),
            sa.Column("topic_id", sa.String(length=64), nullable=False),
            sa.Column("owner_id", sa.String(length=64), nullable=False),
            sa.Column("activity_id", sa.String(length=64), nullable=False),
            sa.Column("activity_version", sa.String(length=32), nullable=False),
            sa.Column("draft", sa.Text(), nullable=False, server_default=""),
            sa.Column("selected_choice", sa.String(length=256), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint(
                "roadmap_id", "topic_id", "owner_id", name="pk_topic_practice_drafts"
            ),
            sa.ForeignKeyConstraint(
                ["roadmap_id", "topic_id"],
                ["curriculum_items.roadmap_id", "curriculum_items.id"],
                ondelete="CASCADE",
                name="fk_practice_draft_topic",
            ),
            sa.ForeignKeyConstraint(
                ["owner_id"],
                ["users.id"],
                ondelete="CASCADE",
                name="fk_practice_draft_owner",
            ),
        )
        op.create_index(
            "idx_practice_draft_owner",
            "topic_practice_drafts",
            ["owner_id", "roadmap_id"],
            unique=False,
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "topic_practice_drafts" in tables:
        op.drop_index("idx_practice_draft_owner", table_name="topic_practice_drafts")
        op.drop_table("topic_practice_drafts")
