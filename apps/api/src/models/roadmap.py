import uuid
from datetime import datetime, timezone
from typing import Any

from database import Base
from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Roadmap(Timestamps, Base):
    __tablename__ = "roadmaps"
    __table_args__ = (
        ForeignKeyConstraint(
            ["current_revision_id", "id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_roadmap_current_revision",
            use_alter=True,
            deferrable=True,
            initially="DEFERRED",
        ),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("roadmap"))
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), unique=True
    )
    canvas_anchor_chat_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), unique=True
    )
    current_revision_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    profile: Mapped[dict[str, Any]] = mapped_column(JSON)
    origin_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)


class CurriculumRevision(Timestamps, Base):
    __tablename__ = "curriculum_revisions"
    __table_args__ = (
        UniqueConstraint("id", "roadmap_id", name="uq_revision_roadmap"),
        ForeignKeyConstraint(
            ["base_revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            name="fk_revision_base",
        ),
        CheckConstraint(
            "status IN ('candidate','active','archived','rejected')", name="ck_revision_status"
        ),
        Index("idx_revision_history", "roadmap_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("rev"))
    roadmap_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmaps.id", ondelete="CASCADE")
    )
    base_revision_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(180))
    outcome: Mapped[str] = mapped_column(Text)
    assumptions: Mapped[list[str]] = mapped_column(JSON)
    core_minutes: Mapped[int] = mapped_column(Integer)
    validation: Mapped[dict[str, Any]] = mapped_column(JSON)


class CurriculumItem(Timestamps, Base):
    __tablename__ = "curriculum_items"
    __table_args__ = (UniqueConstraint("roadmap_id", "id", name="uq_item_roadmap"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True
    )


class RevisionItem(Base):
    __tablename__ = "revision_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_revision_item_revision",
        ),
        ForeignKeyConstraint(
            ["roadmap_id", "item_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_revision_item_identity",
        ),
        CheckConstraint(
            "kind IN ('root','phase','group','choice','topic')", name="ck_revision_item_kind"
        ),
        CheckConstraint("path IN ('core','further')", name="ck_revision_item_path"),
        CheckConstraint(
            "participation IN ('active','archived')", name="ck_revision_item_participation"
        ),
        CheckConstraint(
            "estimate_minutes IS NULL OR estimate_minutes > 0", name="ck_revision_item_effort"
        ),
        Index("idx_revision_item_order", "revision_id", "position"),
        Index("idx_revision_item_membership", "roadmap_id", "item_id"),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(16))
    position: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String(16))
    participation: Mapped[str] = mapped_column(String(16))
    estimate_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    # Input list ordering is separate from an item's presentation order within a group.
    ordinal: Mapped[int] = mapped_column(Integer)


class CurriculumRelation(Base):
    __tablename__ = "curriculum_relations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "source_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_relation_source",
        ),
        ForeignKeyConstraint(
            ["revision_id", "target_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_relation_target",
        ),
        CheckConstraint(
            "kind IN ('contains','prerequisite','recommended_next','alternative')",
            name="ck_relation_kind",
        ),
        Index("idx_relation_target", "revision_id", "target_id"),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    target_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(24), primary_key=True)
    ordinal: Mapped[int] = mapped_column(Integer)


class ChoiceSelection(Base):
    __tablename__ = "choice_selections"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "choice_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_choice_group",
        ),
        ForeignKeyConstraint(
            ["revision_id", "selected_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_choice_selected",
        ),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    choice_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    selected_id: Mapped[str] = mapped_column(String(64))
    rationale: Mapped[str] = mapped_column(Text)
    ordinal: Mapped[int] = mapped_column(Integer)


class WeeklyAssignment(Base):
    __tablename__ = "weekly_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "topic_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_weekly_topic",
        ),
        UniqueConstraint("revision_id", "ordinal", name="uq_weekly_order"),
        CheckConstraint("week > 0 AND minutes > 0 AND sequence >= 0", name="ck_weekly_values"),
        Index("idx_weekly_week", "revision_id", "week"),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    week: Mapped[int] = mapped_column(Integer)
    minutes: Mapped[int] = mapped_column(Integer)
    ordinal: Mapped[int] = mapped_column(Integer)


class ResearchSource(Timestamps, Base):
    __tablename__ = "research_sources"
    __table_args__ = (
        UniqueConstraint("roadmap_id", "id", name="uq_source_roadmap"),
        Index("idx_source_reference", "roadmap_id", "reference_id"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmaps.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    origin_job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)


class RevisionSource(Base):
    __tablename__ = "revision_sources"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_revision_source_revision",
        ),
        ForeignKeyConstraint(
            ["roadmap_id", "source_id"],
            ["research_sources.roadmap_id", "research_sources.id"],
            ondelete="CASCADE",
            name="fk_revision_source_evidence",
        ),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(String(64))
    ordinal: Mapped[int] = mapped_column(Integer)


class TopicResource(Base):
    __tablename__ = "topic_resources"
    __table_args__ = (
        ForeignKeyConstraint(
            ["revision_id", "topic_id"],
            ["revision_items.revision_id", "revision_items.item_id"],
            ondelete="CASCADE",
            name="fk_resource_topic",
        ),
        ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_resource_revision",
        ),
        ForeignKeyConstraint(
            ["roadmap_id", "source_id"],
            ["research_sources.roadmap_id", "research_sources.id"],
            ondelete="CASCADE",
            name="fk_resource_source",
        ),
        Index("idx_resource_source", "roadmap_id", "source_id"),
    )
    revision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    roadmap_id: Mapped[str] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer)
    ordinal: Mapped[int] = mapped_column(Integer)
    rationale: Mapped[str] = mapped_column(Text)


class TopicProgress(Base):
    __tablename__ = "topic_progress"
    __table_args__ = (
        ForeignKeyConstraint(
            ["roadmap_id", "topic_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_progress_identity",
        ),
        CheckConstraint(
            "status IN ('not_started','in_progress','completed')", name="ck_progress_status"
        ),
        Index("idx_progress_owner", "owner_id", "roadmap_id"),
    )
    roadmap_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class TopicChat(Timestamps, Base):
    __tablename__ = "topic_chats"
    __table_args__ = (
        ForeignKeyConstraint(
            ["roadmap_id", "topic_id"],
            ["curriculum_items.roadmap_id", "curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_chat_identity",
        ),
        ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_chat_revision",
        ),
        UniqueConstraint(
            "roadmap_id", "topic_id", "owner_id", "default_key", name="uq_default_topic_chat"
        ),
        UniqueConstraint(
            "roadmap_id", "topic_id", "owner_id", "request_key", name="uq_topic_chat_request"
        ),
        UniqueConstraint("id", "roadmap_id", "topic_id", "owner_id", name="uq_topic_chat_identity"),
        Index("idx_topic_chat_history", "roadmap_id", "topic_id", "owner_id"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("lesson"))
    roadmap_id: Mapped[str] = mapped_column(String(64))
    topic_id: Mapped[str] = mapped_column(String(64))
    owner_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    chat_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), unique=True
    )
    revision_id: Mapped[str] = mapped_column(String(64))
    request_key: Mapped[str] = mapped_column(String(128))
    default_key: Mapped[str | None] = mapped_column(String(16), nullable=True)
    lesson_start_state: Mapped[str] = mapped_column(String(20), default="pending")


class KnowledgeCheck(Base):
    __tablename__ = "knowledge_checks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["session_id", "roadmap_id", "topic_id", "owner_id"],
            [
                "topic_chats.id",
                "topic_chats.roadmap_id",
                "topic_chats.topic_id",
                "topic_chats.owner_id",
            ],
            ondelete="CASCADE",
            name="fk_check_session",
        ),
        ForeignKeyConstraint(
            ["revision_id", "roadmap_id"],
            ["curriculum_revisions.id", "curriculum_revisions.roadmap_id"],
            ondelete="CASCADE",
            name="fk_check_revision",
        ),
        Index("idx_check_topic_history", "roadmap_id", "topic_id", "owner_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("check"))
    roadmap_id: Mapped[str] = mapped_column(String(64))
    topic_id: Mapped[str] = mapped_column(String(64))
    owner_id: Mapped[str] = mapped_column(String(64))
    session_id: Mapped[str] = mapped_column(String(64))
    revision_id: Mapped[str] = mapped_column(String(64))
    rubric: Mapped[dict[str, Any]] = mapped_column(JSON)
    result: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
