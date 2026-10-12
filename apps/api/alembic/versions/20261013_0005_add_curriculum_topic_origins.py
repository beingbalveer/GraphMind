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
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "curriculum_topic_origins" not in tables:
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
                ["roadmap_id"],
                ["roadmaps.id"],
                ondelete="CASCADE",
                name="fk_topic_origin_roadmap",
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
            sa.ForeignKeyConstraint(
                ["source_owner_id"],
                ["users.id"],
                ondelete="SET NULL",
                name="fk_topic_origin_source_owner",
            ),
            sa.ForeignKeyConstraint(["source_chat_id"], ["nodes.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["source_node_id"], ["nodes.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "idx_topic_origin_revision", "curriculum_topic_origins", ["creation_revision_id"]
        )
        return

    existing_columns = {
        column["name"] for column in inspector.get_columns("curriculum_topic_origins")
    }
    if "source_owner_id" not in existing_columns:
        op.add_column(
            "curriculum_topic_origins", sa.Column("source_owner_id", sa.String(64), nullable=True)
        )
    if "source_private" not in existing_columns:
        # Old rows have no trustworthy visibility marker. Keep them private until
        # an owner can be recovered from the still-persisted TopicChat association.
        op.add_column(
            "curriculum_topic_origins", sa.Column("source_private", sa.Boolean(), nullable=True)
        )

    op.execute(
        sa.text(
            "UPDATE curriculum_topic_origins AS origin "
            "SET source_owner_id = topic_chat.owner_id "
            "FROM topic_chats AS topic_chat "
            "WHERE origin.source_chat_id = topic_chat.chat_id "
            "AND origin.source_owner_id IS NULL"
        )
    )
    # Legacy provenance may describe a private lesson. Unknown and deleted sources
    # remain private with no inferred owner, so they are hidden from every reader.
    op.execute(
        sa.text(
            "UPDATE curriculum_topic_origins SET source_private = TRUE "
            "WHERE source_private IS NULL"
        )
    )
    op.alter_column(
        "curriculum_topic_origins",
        "source_private",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.false(),
    )

    inspector = sa.inspect(op.get_bind())
    foreign_keys = inspector.get_foreign_keys("curriculum_topic_origins")
    if not any(
        fk.get("constrained_columns") == ["source_owner_id"]
        and fk.get("referred_table") == "users"
        for fk in foreign_keys
    ):
        op.create_foreign_key(
            "fk_topic_origin_source_owner",
            "curriculum_topic_origins",
            "users",
            ["source_owner_id"],
            ["id"],
            ondelete="SET NULL",
        )

    unique_constraints = inspector.get_unique_constraints("curriculum_topic_origins")
    if not any(
        set(constraint.get("column_names") or []) == {"creation_revision_id", "topic_id"}
        for constraint in unique_constraints
    ):
        op.create_unique_constraint(
            "uq_topic_origin_revision_topic",
            "curriculum_topic_origins",
            ["creation_revision_id", "topic_id"],
        )

    indexes = inspector.get_indexes("curriculum_topic_origins")
    if not any(index.get("column_names") == ["creation_revision_id"] for index in indexes):
        op.create_index(
            "idx_topic_origin_revision", "curriculum_topic_origins", ["creation_revision_id"]
        )


def downgrade() -> None:
    indexes = {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes("curriculum_topic_origins")
    }
    if "idx_topic_origin_revision" in indexes:
        op.drop_index("idx_topic_origin_revision", table_name="curriculum_topic_origins")
    op.drop_table("curriculum_topic_origins")
