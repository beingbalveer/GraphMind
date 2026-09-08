import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from database import Base

if TYPE_CHECKING:
    from models.user import User, WorkspaceMember
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
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

    # Multi-tenancy & Ownership
    owner_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

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
    owner: Mapped["User"] = relationship("User", back_populates="owned_workspaces")
    members: Mapped[List["WorkspaceMember"]] = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
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
    concepts: Mapped[List["ConceptModel"]] = relationship(
        "ConceptModel",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ConceptModel.created_at.desc()",
    )


node_concepts = Table(
    "node_concepts",
    Base.metadata,
    Column("node_id", String(64), ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True),
    Column(
        "concept_id",
        String(64),
        ForeignKey("workspace_concepts.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("created_at", DateTime(timezone=True), default=_utc_now),
    Index("idx_node_concepts_concept_id", "concept_id"),
)


class NodeModel(Base):
    """
    Node model representing a persistent message and canvas card.
    """

    __tablename__ = "nodes"
    __table_args__ = (
        Index("idx_nodes_workspace_created", "workspace_id", "created_at"),
    )

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
    concepts: Mapped[List["ConceptModel"]] = relationship(
        "ConceptModel",
        secondary=node_concepts,
        back_populates="nodes",
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
    chunks: Mapped[List["WorkspaceFileChunk"]] = relationship(
        "WorkspaceFileChunk",
        back_populates="file",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="WorkspaceFileChunk.chunk_index",
    )


class WorkspaceFileChunk(Base):
    """
    Semantic chunk of an uploaded workspace file for Enterprise RAG.
    Dual-indexed with:
      - pgvector dense embeddings for semantic search (HNSW index)
      - PostgreSQL tsvector for lexical keyword matching (GIN index)
    """

    __tablename__ = "workspace_file_chunks"

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"chunk_{uuid.uuid4().hex[:12]}",
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspace_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    enriched_content: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    section_header: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    metadata_payload: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    # 768-dimensional dense vector embedding (text-embedding-004)
    embedding: Mapped[Optional[List[float]]] = mapped_column(
        Vector(768),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utc_now,
    )

    # Relationships
    file: Mapped["WorkspaceFile"] = relationship("WorkspaceFile", back_populates="chunks")
    workspace: Mapped["Workspace"] = relationship("Workspace")


class ConceptModel(Base):
    """
    Persistent concept mastery model representing a tracked technical skill/concept.
    """

    __tablename__ = "workspace_concepts"
    __table_args__ = (
        Index("idx_concepts_workspace_created", "workspace_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(64),
        primary_key=True,
        default=lambda: f"concept_{uuid.uuid4().hex[:12]}",
    )
    workspace_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Mastery state: unexplored, explored, quizzed, mastered, stale
    mastery_level: Mapped[str] = mapped_column(String(32), nullable=False, default="explored")
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    times_quizzed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    times_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    metadata_payload: Mapped[Dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    # 768-dimensional dense vector embedding (optional for semantic grouping)
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
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="concepts")
    nodes: Mapped[List["NodeModel"]] = relationship(
        "NodeModel",
        secondary=node_concepts,
        back_populates="concepts",
    )

