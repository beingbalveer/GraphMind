"""add flashcards

Revision ID: 20260911_0001
Revises: None
Create Date: 2026-09-11 10:45:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.engine.reflection import Inspector

revision: str = "20260911_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if "workspaces" not in tables or "nodes" not in tables:
        raise RuntimeError(
            "Phase 4 base tables ('workspaces' and 'nodes') must exist before running flashcard migration."
        )

    if "flashcards" not in tables:
        op.create_table(
            "flashcards",
            sa.Column("id", sa.String(length=64), nullable=False),
            sa.Column("workspace_id", sa.String(length=64), nullable=False),
            sa.Column("source_node_id", sa.String(length=64), nullable=False),
            sa.Column("question", sa.Text(), nullable=False),
            sa.Column("answer", sa.Text(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["source_node_id"], ["nodes.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "idx_flashcards_source_position",
            "flashcards",
            ["source_node_id", "position"],
            unique=False,
        )
        op.create_index(
            "idx_flashcards_workspace_created",
            "flashcards",
            ["workspace_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    tables = inspector.get_table_names()

    if "flashcards" in tables:
        op.drop_index("idx_flashcards_workspace_created", table_name="flashcards")
        op.drop_index("idx_flashcards_source_position", table_name="flashcards")
        op.drop_table("flashcards")
