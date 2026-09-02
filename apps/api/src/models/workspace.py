import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import Base
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(Base):
    """
    Workspace model containing a persistent knowledge graph of conversation nodes and edges.
    """

    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"ws_{uuid.uuid4().hex[:12]}",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Workspace")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 2D Spatial Viewport State
    viewport_x: Mapped[float] = mapped_column(Float, default=0.0)
    viewport_y: Mapped[float] = mapped_column(Float, default=0.0)
    zoom: Mapped[float] = mapped_column(Float, default=0.85)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
    )

    # Relationships
    nodes: Mapped[List["NodeModel"]] = relationship(
        "NodeModel",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="NodeModel.created_at",
    )
    edges: Mapped[List["EdgeModel"]] = relationship(
        "EdgeModel",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    files: Mapped[List["WorkspaceFile"]] = relationship(
        "WorkspaceFile",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="WorkspaceFile.created_at.desc()",
    )


class NodeModel(Base):
    """
    Node model representing a persistent message and canvas card.
    """

    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"node_{uuid.uuid4().hex[:12]}",
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey("nodes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    highlighted_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # 2D Canvas Coordinates
    position_x: Mapped[float] = mapped_column(Float, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, default=0.0)

    metadata_payload: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    # 768-dimensional dense vector embedding for semantic search and discovery
    embedding: Mapped[Optional[List[float]]] = mapped_column(
        Vector(768),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
        onupdate=_utc_now,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="nodes")
    children: Mapped[List["NodeModel"]] = relationship(
        "NodeModel",
        backref=None,
        cascade="all",
    )


class EdgeModel(Base):
    """
    Edge model representing a directed relationship link between conversation nodes.
    """

    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(
        String(128),
        primary_key=True,
        default=lambda: f"edge_{uuid.uuid4().hex[:12]}",
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relation_type: Mapped[str] = mapped_column(String(32), default="branch")
    highlighted_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="edges")


class WorkspaceFile(Base):
    """
    Persistent file asset belonging to a workspace library.
    """

    __tablename__ = "workspace_files"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"file_{uuid.uuid4().hex[:12]}",
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    file_category: Mapped[str] = mapped_column(String(32), nullable=False, default="image")
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="files")

