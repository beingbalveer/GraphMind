"""Owned-data export service (LSI-045).

Assembles a versioned JSON archive of a single workspace's caller-owned data.
Only the fields declared by the export schemas are copied from each row, so
internal storage paths, embeddings, and metadata JSON are never serialized.
"""

from datetime import datetime, timezone

from models.flashcard import FlashcardModel
from models.workspace import ConceptModel, EdgeModel, NodeModel, Workspace, WorkspaceFile
from schemas.export import (
    EXPORT_VERSION,
    ExportConcept,
    ExportCounts,
    ExportEdge,
    ExportFile,
    ExportFlashcard,
    ExportNode,
    ExportWorkspaceMeta,
    WorkspaceExportResponse,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class WorkspaceExportService:
    @classmethod
    async def build_export(
        cls, db: AsyncSession, workspace: Workspace
    ) -> WorkspaceExportResponse:
        """Build the versioned export archive for an already-authorized workspace."""
        nodes = list(
            (
                await db.execute(
                    select(NodeModel)
                    .where(NodeModel.workspace_id == workspace.id)
                    .order_by(NodeModel.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        edges = list(
            (
                await db.execute(
                    select(EdgeModel)
                    .where(EdgeModel.workspace_id == workspace.id)
                    .order_by(EdgeModel.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        concepts = list(
            (
                await db.execute(
                    select(ConceptModel)
                    .where(ConceptModel.workspace_id == workspace.id)
                    .order_by(ConceptModel.created_at.asc())
                )
            )
            .scalars()
            .all()
        )
        flashcards = list(
            (
                await db.execute(
                    select(FlashcardModel)
                    .where(FlashcardModel.workspace_id == workspace.id)
                    .order_by(FlashcardModel.position.asc())
                )
            )
            .scalars()
            .all()
        )
        files = list(
            (
                await db.execute(
                    select(WorkspaceFile)
                    .where(WorkspaceFile.workspace_id == workspace.id)
                    .order_by(WorkspaceFile.created_at.asc())
                )
            )
            .scalars()
            .all()
        )

        export_nodes = [ExportNode.model_validate(node) for node in nodes]
        export_edges = [ExportEdge.model_validate(edge) for edge in edges]
        export_concepts = [ExportConcept.model_validate(concept) for concept in concepts]
        export_flashcards = [
            ExportFlashcard.model_validate(card) for card in flashcards
        ]
        export_files = [ExportFile.model_validate(file) for file in files]

        return WorkspaceExportResponse(
            export_version=EXPORT_VERSION,
            exported_at=datetime.now(timezone.utc),
            workspace=ExportWorkspaceMeta.model_validate(workspace),
            nodes=export_nodes,
            edges=export_edges,
            concepts=export_concepts,
            flashcards=export_flashcards,
            files=export_files,
            counts=ExportCounts(
                nodes=len(export_nodes),
                edges=len(export_edges),
                concepts=len(export_concepts),
                flashcards=len(export_flashcards),
                files=len(export_files),
            ),
        )
