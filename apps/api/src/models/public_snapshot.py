"""Immutable public snapshot storage (LSI-025).

Public snapshots are a *read-only projection* of a validated private curriculum
revision, frozen at publication time. They are intentionally decoupled from the
private curriculum tables so that unpublishing (or deleting a private copy)
never mutates published content, and so that no private identity can surface in
a public payload:

* ``public_snapshots`` / ``..._phases`` / ``..._topics`` / ``..._sources`` /
  ``..._topic_sources`` hold only vetted lesson and reference data.
* ``public_snapshot_origins`` is the one exception: it is private provenance
  (which workspace/roadmap/revision/user published this), used for audit and
  publication permission checks. It is never read by public DTO builders.
"""

from datetime import datetime

from database import Base
from models.roadmap import Timestamps, new_id
from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column


class PublicSnapshot(Timestamps, Base):
    """A frozen, versioned public roadmap. Content is immutable once published."""

    __tablename__ = "public_snapshots"
    __table_args__ = (
        UniqueConstraint("template_id", "snapshot_version", name="uq_public_snapshot_version"),
        # ``slug`` identifies the roadmap *template* (the detail route is
        # ``/public/roadmaps/{slug}``), so every published version of one
        # template reuses the same slug. That cannot be expressed as a single
        # table constraint (a unique on ``slug`` would block new versions, a
        # unique on ``(template_id, slug)`` would too), so cross-template slug
        # uniqueness is enforced by the publication service.
        Index("ix_public_snapshots_slug", "slug"),
        CheckConstraint("status IN ('published','unpublished')", name="ck_public_snapshot_status"),
        CheckConstraint(
            "level IN ('beginner','intermediate','advanced')", name="ck_public_snapshot_level"
        ),
        CheckConstraint("estimated_weeks BETWEEN 1 AND 104", name="ck_public_snapshot_weeks"),
        CheckConstraint(
            "hours_per_week > 0 AND hours_per_week <= 80", name="ck_public_snapshot_hours"
        ),
        CheckConstraint("topic_count > 0", name="ck_public_snapshot_topic_count"),
        Index("idx_public_snapshot_catalog", "status", "category", "level"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("pub"))
    template_id: Mapped[str] = mapped_column(String(64), index=True)
    snapshot_version: Mapped[str] = mapped_column(String(32))
    slug: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(180))
    summary: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(64))
    level: Mapped[str] = mapped_column(String(16))
    estimated_weeks: Mapped[int] = mapped_column(Integer)
    hours_per_week: Mapped[float] = mapped_column(Float)
    topic_count: Mapped[int] = mapped_column(Integer)
    outcomes: Mapped[list[str]] = mapped_column(JSON, default=list)
    prerequisites: Mapped[list[str]] = mapped_column(JSON, default=list)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="published")
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    unpublished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PublicSnapshotPhase(Base):
    __tablename__ = "public_snapshot_phases"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_phase_snapshot",
        ),
        CheckConstraint("path IN ('core','further')", name="ck_public_phase_path"),
        Index("idx_public_phase_order", "snapshot_id", "position"),
    )

    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    phase_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    position: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String(16), default="core")


class PublicSnapshotTopic(Base):
    __tablename__ = "public_snapshot_topics"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_topic_snapshot",
        ),
        ForeignKeyConstraint(
            ["snapshot_id", "phase_id"],
            ["public_snapshot_phases.snapshot_id", "public_snapshot_phases.phase_id"],
            ondelete="CASCADE",
            name="fk_public_topic_phase",
        ),
        UniqueConstraint("snapshot_id", "slug", name="uq_public_topic_slug"),
        CheckConstraint("path IN ('core','further')", name="ck_public_topic_path"),
        CheckConstraint(
            "format IS NULL OR format IN ('concepts','practice','project')",
            name="ck_public_topic_format",
        ),
        CheckConstraint(
            "estimate_minutes IS NULL OR estimate_minutes > 0",
            name="ck_public_topic_effort",
        ),
        Index("idx_public_topic_order", "snapshot_id", "position"),
        Index("idx_public_topic_phase", "snapshot_id", "phase_id"),
    )

    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    phase_id: Mapped[str] = mapped_column(String(64))
    slug: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(180))
    brief: Mapped[str] = mapped_column(Text, default="")
    objectives: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    exercise: Mapped[str | None] = mapped_column(Text, nullable=True)
    format: Mapped[str | None] = mapped_column(String(16), nullable=True)
    estimate_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    path: Mapped[str] = mapped_column(String(16), default="core")
    position: Mapped[int] = mapped_column(Integer)
    prerequisites: Mapped[list[str]] = mapped_column(JSON, default=list)


class PublicSnapshotSource(Base):
    __tablename__ = "public_snapshot_sources"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_source_snapshot",
        ),
        Index("idx_public_source_snapshot", "snapshot_id"),
    )

    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(1000))
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    locator: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    kind: Mapped[str] = mapped_column(String(100), default="article")
    position: Mapped[int] = mapped_column(Integer)


class PublicSnapshotTopicSource(Base):
    __tablename__ = "public_snapshot_topic_sources"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id", "topic_id"],
            ["public_snapshot_topics.snapshot_id", "public_snapshot_topics.topic_id"],
            ondelete="CASCADE",
            name="fk_public_topic_source_topic",
        ),
        ForeignKeyConstraint(
            ["snapshot_id", "source_id"],
            ["public_snapshot_sources.snapshot_id", "public_snapshot_sources.source_id"],
            ondelete="CASCADE",
            name="fk_public_topic_source_source",
        ),
        Index("idx_public_topic_source_topic", "snapshot_id", "topic_id"),
    )

    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)


class PublicSnapshotOrigin(Base):
    """Private publication provenance. Never read by public DTO builders.

    The foreign keys are ``SET NULL``: a public snapshot survives unpublishing
    and the deletion of the private copy it was curated from.
    """

    __tablename__ = "public_snapshot_origins"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id"],
            ["public_snapshots.id"],
            ondelete="CASCADE",
            name="fk_public_origin_snapshot",
        ),
        ForeignKeyConstraint(
            ["source_workspace_id"],
            ["workspaces.id"],
            ondelete="SET NULL",
            name="fk_public_origin_workspace",
        ),
        ForeignKeyConstraint(
            ["source_roadmap_id"],
            ["roadmaps.id"],
            ondelete="SET NULL",
            name="fk_public_origin_roadmap",
        ),
        ForeignKeyConstraint(
            ["source_revision_id"],
            ["curriculum_revisions.id"],
            ondelete="SET NULL",
            name="fk_public_origin_revision",
        ),
        ForeignKeyConstraint(
            ["published_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="fk_public_origin_publisher",
        ),
    )

    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_workspace_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_roadmap_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_revision_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    published_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
