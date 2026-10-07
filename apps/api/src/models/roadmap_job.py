from datetime import datetime
from typing import Any

from database import Base
from models.roadmap import Timestamps, new_id
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column


class RoadmapJob(Timestamps, Base):
    __tablename__ = "roadmap_jobs"
    __table_args__ = (
        UniqueConstraint("owner_id", "operation", "idempotency_key", name="uq_job_request_key"),
        CheckConstraint("operation IN ('generate','refine')", name="ck_job_operation"),
        CheckConstraint(
            "status IN ('queued','running','awaiting_input','cancel_requested','canceled','failed','completed')",
            name="ck_job_status",
        ),
        CheckConstraint(
            "stage IN ('understand','research','compose','personalize','validate','publish')",
            name="ck_job_stage",
        ),
        CheckConstraint("question_count BETWEEN 0 AND 3", name="ck_job_questions"),
        Index(
            "uq_job_active_owner",
            "owner_id",
            unique=True,
            postgresql_where=text(
                "startup_ready AND status IN ('queued','running','awaiting_input','cancel_requested')"
            ),
        ),
        Index("idx_job_claim", "status", "startup_ready", "lease_until", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("job"))
    owner_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    operation: Mapped[str] = mapped_column(String(16))
    idempotency_key: Mapped[str] = mapped_column(String(128))
    request_hash: Mapped[str] = mapped_column(String(64))
    request: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(24), default="queued")
    stage: Mapped[str] = mapped_column(String(20), default="understand")
    startup_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    checkpoint: Mapped[dict[str, Any]] = mapped_column(JSON)
    usage: Mapped[dict[str, Any]] = mapped_column(JSON)
    limits: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    question: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    last_sequence: Mapped[int] = mapped_column(Integer, default=0)
    base_revision_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("curriculum_revisions.id", ondelete="SET NULL"), nullable=True
    )
    fence: Mapped[int] = mapped_column(Integer, default=0)
    worker_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RoadmapJobEvent(Base):
    __tablename__ = "roadmap_job_events"
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmap_jobs.id", ondelete="CASCADE"), primary_key=True
    )
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage: Mapped[str] = mapped_column(String(20))
    type: Mapped[str] = mapped_column(String(32))
    summary: Mapped[str] = mapped_column(String(500))
    details: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RoadmapToolReceipt(Base):
    __tablename__ = "roadmap_tool_receipts"
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmap_jobs.id", ondelete="CASCADE"), primary_key=True
    )
    stage: Mapped[str] = mapped_column(String(20), primary_key=True)
    operation_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    reservations: Mapped[dict[str, Any]] = mapped_column(JSON)


class RoadmapJobReference(Timestamps, Base):
    __tablename__ = "roadmap_job_references"
    __table_args__ = (
        UniqueConstraint("job_id", "dedup_key", name="uq_job_reference_dedup"),
        CheckConstraint("kind IN ('file','link')", name="ck_job_reference_kind"),
        CheckConstraint("size_bytes >= 0", name="ck_job_reference_size"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("ref"))
    job_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmap_jobs.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(255))
    dedup_key: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20))
    size_bytes: Mapped[int] = mapped_column(Integer)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    sections: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    workspace_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
