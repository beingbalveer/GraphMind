"""add curriculum

Revision ID: 20261007_0003
Revises: 20261007_0002
Create Date: 2026-10-07 18:54:50.518730

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261007_0003"
down_revision: Union[str, None] = "20261007_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    owned = {
        "knowledge_checks",
        "research_sources",
        "topic_chats",
        "topic_resources",
        "revision_items",
        "curriculum_revisions",
        "curriculum_items",
        "choice_selections",
        "curriculum_relations",
        "revision_sources",
        "roadmaps",
        "weekly_assignments",
        "topic_progress",
    }
    existing = tables & owned
    if existing == owned:
        return  # The API's additive startup metadata already installed this schema.
    if existing:
        raise RuntimeError("Curriculum schema is partially initialized; reconcile before migrating")

    op.create_table(
        "roadmaps",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("canvas_anchor_chat_id", sa.String(length=64), nullable=False),
        sa.Column("current_revision_id", sa.String(length=64), nullable=True),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("origin_job_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["canvas_anchor_chat_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canvas_anchor_chat_id"),
        sa.UniqueConstraint("origin_job_id"),
        sa.UniqueConstraint("workspace_id"),
    )
    op.create_index(op.f("ix_roadmaps_owner_id"), "roadmaps", ["owner_id"], unique=False)
    op.create_table(
        "curriculum_items",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("roadmap_id", "id", name="uq_item_roadmap"),
    )
    op.create_index(
        op.f("ix_curriculum_items_roadmap_id"), "curriculum_items", ["roadmap_id"], unique=False
    )
    op.create_table(
        "curriculum_revisions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("base_revision_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
        sa.Column("assumptions", sa.JSON(), nullable=False),
        sa.Column("core_minutes", sa.Integer(), nullable=False),
        sa.Column("validation", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('candidate','active','archived','rejected')", name="ck_revision_status"
        ),
        sa.ForeignKeyConstraint(
            ["base_revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_revision_base",
        ),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "roadmap_id", name="uq_revision_roadmap"),
    )
    op.create_index(
        "idx_revision_history", "curriculum_revisions", ["roadmap_id", "created_at"], unique=False
    )
    op.create_table(
        "research_sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("origin_job_id", sa.String(length=64), nullable=True),
        sa.Column("reference_id", sa.String(length=64), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["roadmap_id"], ["roadmaps.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("roadmap_id", "id", name="uq_source_roadmap"),
    )
    op.create_index(
        "idx_source_reference", "research_sources", ["roadmap_id", "reference_id"], unique=False
    )
    op.create_index(
        op.f("ix_research_sources_roadmap_id"), "research_sources", ["roadmap_id"], unique=False
    )
    op.create_table(
        "revision_items",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=16), nullable=False),
        sa.Column("participation", sa.String(length=16), nullable=False),
        sa.Column("estimate_minutes", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('root','phase','group','choice','topic')", name="ck_revision_item_kind"
        ),
        sa.CheckConstraint(
            "participation IN ('active','archived')", name="ck_revision_item_participation"
        ),
        sa.CheckConstraint("path IN ('core','further')", name="ck_revision_item_path"),
        sa.CheckConstraint(
            "estimate_minutes IS NULL OR estimate_minutes > 0", name="ck_revision_item_effort"
        ),
        sa.ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_revision_item_revision",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "item_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            name="fk_revision_item_identity",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "item_id"),
    )
    op.create_index(
        "idx_revision_item_membership", "revision_items", ["roadmap_id", "item_id"], unique=False
    )
    op.create_index(
        "idx_revision_item_order", "revision_items", ["revision_id", "position"], unique=False
    )
    op.create_table(
        "revision_sources",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_revision_source_revision",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "source_id"],
            ["research_sources.roadmap_id", "research_sources.id"],
            name="fk_revision_source_evidence",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "source_id"),
    )
    op.create_table(
        "topic_chats",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("chat_id", sa.String(length=64), nullable=False),
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("request_key", sa.String(length=128), nullable=False),
        sa.Column("default_key", sa.String(length=16), nullable=True),
        sa.Column("lesson_start_state", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["chat_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_chat_revision",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "topic_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            name="fk_chat_identity",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_id"),
        sa.UniqueConstraint(
            "id", "roadmap_id", "topic_id", "owner_id", name="uq_topic_chat_identity"
        ),
        sa.UniqueConstraint(
            "roadmap_id", "topic_id", "owner_id", "default_key", name="uq_default_topic_chat"
        ),
        sa.UniqueConstraint(
            "roadmap_id", "topic_id", "owner_id", "request_key", name="uq_topic_chat_request"
        ),
    )
    op.create_index(
        "idx_topic_chat_history",
        "topic_chats",
        ["roadmap_id", "topic_id", "owner_id"],
        unique=False,
    )
    op.create_table(
        "topic_progress",
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('not_started','in_progress','completed')", name="ck_progress_status"
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "topic_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            name="fk_progress_identity",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("roadmap_id", "topic_id", "owner_id"),
    )
    op.create_index(
        "idx_progress_owner", "topic_progress", ["owner_id", "roadmap_id"], unique=False
    )
    op.create_table(
        "choice_selections",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("choice_id", sa.String(length=64), nullable=False),
        sa.Column("selected_id", sa.String(length=64), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["revision_id", "choice_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_choice_group",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id", "selected_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_choice_selected",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "choice_id"),
    )
    op.create_table(
        "curriculum_relations",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=24), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('contains','prerequisite','recommended_next','alternative')",
            name="ck_relation_kind",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id", "source_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_relation_source",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id", "target_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_relation_target",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "source_id", "target_id", "kind"),
    )
    op.create_index(
        "idx_relation_target", "curriculum_relations", ["revision_id", "target_id"], unique=False
    )
    op.create_table(
        "knowledge_checks",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=64), nullable=False),
        sa.Column("session_id", sa.String(length=64), nullable=False),
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("rubric", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_check_revision",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["session_id", "roadmap_id", "topic_id", "owner_id"],
            [
                "topic_chats.id",
                "topic_chats.roadmap_id",
                "topic_chats.topic_id",
                "topic_chats.owner_id",
            ],
            name="fk_check_session",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_check_topic_history",
        "knowledge_checks",
        ["roadmap_id", "topic_id", "owner_id", "created_at"],
        unique=False,
    )
    op.create_table(
        "topic_resources",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("roadmap_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_resource_revision",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["revision_id", "topic_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_resource_topic",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["roadmap_id", "source_id"],
            ["research_sources.roadmap_id", "research_sources.id"],
            name="fk_resource_source",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "topic_id", "source_id"),
    )
    op.create_index(
        "idx_resource_source", "topic_resources", ["roadmap_id", "source_id"], unique=False
    )
    op.create_table(
        "weekly_assignments",
        sa.Column("revision_id", sa.String(length=64), nullable=False),
        sa.Column("topic_id", sa.String(length=64), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("week", sa.Integer(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.CheckConstraint("week > 0 AND minutes > 0 AND sequence >= 0", name="ck_weekly_values"),
        sa.ForeignKeyConstraint(
            ["revision_id", "topic_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            name="fk_weekly_topic",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("revision_id", "topic_id", "sequence"),
        sa.UniqueConstraint("revision_id", "ordinal", name="uq_weekly_order"),
    )
    op.create_index("idx_weekly_week", "weekly_assignments", ["revision_id", "week"], unique=False)
    op.create_foreign_key(
        "fk_roadmap_current_revision",
        "roadmaps",
        "curriculum_revisions",
        ["current_revision_id", "id"],
        ["id", "roadmap_id"],
        deferrable=True,
        initially="DEFERRED",
    )


def downgrade() -> None:
    op.drop_constraint("fk_roadmap_current_revision", "roadmaps", type_="foreignkey")

    op.drop_index("idx_weekly_week", table_name="weekly_assignments")
    op.drop_table("weekly_assignments")
    op.drop_index("idx_resource_source", table_name="topic_resources")
    op.drop_table("topic_resources")
    op.drop_index("idx_check_topic_history", table_name="knowledge_checks")
    op.drop_table("knowledge_checks")
    op.drop_index("idx_relation_target", table_name="curriculum_relations")
    op.drop_table("curriculum_relations")
    op.drop_table("choice_selections")
    op.drop_index("idx_progress_owner", table_name="topic_progress")
    op.drop_table("topic_progress")
    op.drop_index("idx_topic_chat_history", table_name="topic_chats")
    op.drop_table("topic_chats")
    op.drop_table("revision_sources")
    op.drop_index("idx_revision_item_order", table_name="revision_items")
    op.drop_index("idx_revision_item_membership", table_name="revision_items")
    op.drop_table("revision_items")
    op.drop_index(op.f("ix_research_sources_roadmap_id"), table_name="research_sources")
    op.drop_index("idx_source_reference", table_name="research_sources")
    op.drop_table("research_sources")
    op.drop_index("idx_revision_history", table_name="curriculum_revisions")
    op.drop_table("curriculum_revisions")
    op.drop_index(op.f("ix_curriculum_items_roadmap_id"), table_name="curriculum_items")
    op.drop_table("curriculum_items")
    op.drop_index(op.f("ix_roadmaps_owner_id"), table_name="roadmaps")
    op.drop_table("roadmaps")
