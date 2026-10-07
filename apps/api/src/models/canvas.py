from datetime import datetime, timezone
from typing import Any

from database import Base
from sqlalchemy import JSON, CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CanvasLayoutModel(Base):
    __tablename__ = "canvas_layouts"
    __table_args__ = (
        CheckConstraint("graph_kind IN ('conversation', 'curriculum')", name="ck_canvas_kind"),
        CheckConstraint("revision > 0", name="ck_canvas_revision"),
    )

    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    chat_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True
    )
    graph_kind: Mapped[str] = mapped_column(String(20), primary_key=True)
    layout_version: Mapped[str] = mapped_column(String(32))
    positions: Mapped[dict[str, Any]] = mapped_column(JSON)
    viewport: Mapped[dict[str, float] | None] = mapped_column(JSON, nullable=True)
    topology_key: Mapped[str] = mapped_column(String(100000))
    revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
