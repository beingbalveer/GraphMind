"""Private copies saved from immutable public snapshots (LSI-028).

A *save copy* is the private, workspace-owned materialization of one published
public snapshot (LSI-025). It is deliberately kept separate from the public
snapshot tables: saving never mutates `public_snapshots`, and unpublishing a
snapshot never touches a learner's private copy.

Two records make up a copy:

* ``public_snapshot_copies`` — the enrollment identity. It binds one authorized
  workspace to one public ``template_id``/``snapshot_version`` and to the private
  ``roadmap_id``/``revision_id`` it produced. The ``(workspace_id, template_id)``
  unique constraint is the durability guarantee for an idempotent retry, and the
  ``(workspace_id, idempotency_key)`` constraint rejects a key reused for a
  different template.
* ``public_snapshot_copy_topics`` — the durable public-topic → private-topic map.
  Public topic IDs are opaque (``pub_topic_*``) and the reused private IDs are
  new, so resuming a saved copy (LSI-031/LSI-032) needs this explicit map rather
  than any ID equality assumption.
"""

from database import Base
from models.roadmap import Timestamps, new_id
from sqlalchemy import (
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column


class PublicSnapshotCopy(Timestamps, Base):
    """The private enrollment produced by saving one published snapshot."""

    __tablename__ = "public_snapshot_copies"
    __table_args__ = (
        # One copy per workspace/template: the atomic idempotency guarantee.
        UniqueConstraint("workspace_id", "template_id", name="uq_copy_workspace_template"),
        # A single idempotency key may never produce two different copies.
        UniqueConstraint("workspace_id", "idempotency_key", name="uq_copy_workspace_key"),
        Index("idx_copy_template_version", "template_id", "snapshot_version"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: new_id("copy"))
    workspace_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("workspaces.id", ondelete="CASCADE")
    )
    template_id: Mapped[str] = mapped_column(String(64))
    snapshot_version: Mapped[str] = mapped_column(String(32))
    snapshot_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("public_snapshots.id", ondelete="CASCADE")
    )
    roadmap_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roadmaps.id", ondelete="CASCADE"), unique=True
    )
    revision_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("curriculum_revisions.id", ondelete="CASCADE")
    )
    idempotency_key: Mapped[str] = mapped_column(String(64))


class PublicSnapshotCopyTopic(Base):
    """Durable public-topic → private-topic map for one saved copy."""

    __tablename__ = "public_snapshot_copy_topics"
    __table_args__ = (
        ForeignKeyConstraint(
            ["copy_id"],
            ["public_snapshot_copies.id"],
            ondelete="CASCADE",
            name="fk_copy_topic_copy",
        ),
        ForeignKeyConstraint(
            ["private_topic_id"],
            ["curriculum_items.id"],
            ondelete="CASCADE",
            name="fk_copy_topic_private",
        ),
        Index("idx_copy_topic_private", "copy_id", "private_topic_id"),
    )

    copy_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    public_topic_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    private_topic_id: Mapped[str] = mapped_column(String(64))
    position: Mapped[int] = mapped_column(Integer)
