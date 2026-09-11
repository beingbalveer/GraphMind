import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from database import Base
from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from models.workspace import NodeModel, Workspace


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class FlashcardModel(Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        Index("idx_flashcards_source_position", "source_node_id", "position"),
        Index("idx_flashcards_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(64), primary_key=True, default=lambda: f"card_{uuid.uuid4().hex[:12]}"
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    source_node_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="flashcards")
    source_node: Mapped["NodeModel"] = relationship("NodeModel", back_populates="flashcards")
