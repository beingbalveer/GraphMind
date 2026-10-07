"""add roadmap jobs

Revision ID: 20261007_0004
Revises: 20261007_0003
Create Date: 2026-10-07 19:12:24.829571

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261007_0004"
down_revision: Union[str, None] = "20261007_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    owned = {
        "roadmap_jobs",
        "roadmap_job_events",
        "roadmap_job_references",
        "roadmap_tool_receipts",
    }
    existing = tables & owned
    if existing == owned:
        return
    if existing:
        raise RuntimeError(
            "Roadmap job schema is partially initialized; reconcile before migrating"
        )
    op.create_table(
        "roadmap_jobs",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("operation", sa.String(length=16), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("startup_ready", sa.Boolean(), nullable=False),
        sa.Column("checkpoint", sa.JSON(), nullable=False),
        sa.Column("usage", sa.JSON(), nullable=False),
        sa.Column("limits", sa.JSON(), nullable=True),
        sa.Column("question", sa.JSON(), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("error", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("last_sequence", sa.Integer(), nullable=False),
        sa.Column("base_revision_id", sa.String(length=64), nullable=True),
        sa.Column("fence", sa.Integer(), nullable=False),
        sa.Column("worker_id", sa.String(length=128), nullable=True),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("operation IN ('generate','refine')", name="ck_job_operation"),
        sa.CheckConstraint(
            "stage IN ('understand','research','compose','personalize','validate','publish')",
            name="ck_job_stage",
        ),
        sa.CheckConstraint(
            "status IN ('queued','running','awaiting_input','cancel_requested','canceled','failed','completed')",
            name="ck_job_status",
        ),
        sa.CheckConstraint("question_count BETWEEN 0 AND 3", name="ck_job_questions"),
        sa.ForeignKeyConstraint(
            ["base_revision_id"], ["curriculum_revisions.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id", "operation", "idempotency_key", name="uq_job_request_key"),
    )
    op.create_index(
        "idx_job_claim",
        "roadmap_jobs",
        ["status", "startup_ready", "lease_until", "created_at"],
        unique=False,
    )
    op.create_index(
        "uq_job_active_owner",
        "roadmap_jobs",
        ["owner_id"],
        unique=True,
        postgresql_where=sa.text(
            "startup_ready AND status IN ('queued','running','awaiting_input','cancel_requested')"
        ),
    )
    op.create_table(
        "roadmap_job_events",
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["roadmap_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("job_id", "sequence"),
    )
    op.create_table(
        "roadmap_job_references",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("dedup_key", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("storage_path", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("sections", sa.JSON(), nullable=False),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('file','link')", name="ck_job_reference_kind"),
        sa.CheckConstraint("size_bytes >= 0", name="ck_job_reference_size"),
        sa.ForeignKeyConstraint(["job_id"], ["roadmap_jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "dedup_key", name="uq_job_reference_dedup"),
    )
    op.create_index(
        op.f("ix_roadmap_job_references_job_id"), "roadmap_job_references", ["job_id"], unique=False
    )
    op.create_table(
        "roadmap_tool_receipts",
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("operation_key", sa.String(length=128), nullable=False),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("reservations", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["roadmap_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("job_id", "stage", "operation_key"),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table("roadmap_tool_receipts")
    op.drop_index(op.f("ix_roadmap_job_references_job_id"), table_name="roadmap_job_references")
    op.drop_table("roadmap_job_references")
    op.drop_table("roadmap_job_events")
    op.drop_index(
        "uq_job_active_owner",
        table_name="roadmap_jobs",
        postgresql_where=sa.text(
            "startup_ready AND status IN ('queued','running','awaiting_input','cancel_requested')"
        ),
    )
    op.drop_index("idx_job_claim", table_name="roadmap_jobs")
    op.drop_table("roadmap_jobs")
    # ### end Alembic commands ###
