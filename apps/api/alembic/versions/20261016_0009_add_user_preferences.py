"""add user preferences table

Revision ID: 20261016_0009
Revises: 20261016_0008
Create Date: 2026-10-16
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261016_0009"
down_revision: Union[str, None] = "20261016_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "user_preferences" not in tables:
        op.create_table(
            "user_preferences",
            sa.Column("user_id", sa.String(length=64), nullable=False),
            sa.Column("theme", sa.String(length=16), nullable=False, server_default="system"),
            sa.Column(
                "reading_font_size",
                sa.String(length=8),
                nullable=False,
                server_default="md",
            ),
            sa.Column(
                "reduced_motion",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
            sa.Column(
                "default_study_hours",
                sa.Float(),
                nullable=False,
                server_default="4.0",
            ),
            sa.Column(
                "tutor_style",
                sa.String(length=16),
                nullable=False,
                server_default="socratic",
            ),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("user_id", name="pk_user_preferences"),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["users.id"],
                ondelete="CASCADE",
                name="fk_user_preferences_user",
            ),
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "user_preferences" in tables:
        op.drop_table("user_preferences")
