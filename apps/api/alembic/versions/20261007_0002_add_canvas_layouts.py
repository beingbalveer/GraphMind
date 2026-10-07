"""Add versioned canvas layouts without altering conversation coordinates."""
import sqlalchemy as sa
from alembic import op

revision = "20261007_0002"
down_revision = "20260911_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Startup also creates additive tables; support installations using either path.
    if "canvas_layouts" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "canvas_layouts",
        sa.Column("workspace_id", sa.String(64), nullable=False),
        sa.Column("chat_id", sa.String(64), nullable=False),
        sa.Column("graph_kind", sa.String(20), nullable=False),
        sa.Column("layout_version", sa.String(32), nullable=False),
        sa.Column("positions", sa.JSON(), nullable=False),
        sa.Column("viewport", sa.JSON(), nullable=True),
        sa.Column("topology_key", sa.String(100000), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["chat_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("workspace_id", "chat_id", "graph_kind"),
        sa.CheckConstraint("graph_kind IN ('conversation', 'curriculum')", name="ck_canvas_kind"),
        sa.CheckConstraint("revision > 0", name="ck_canvas_revision"),
    )


def downgrade() -> None:
    op.drop_table("canvas_layouts")
