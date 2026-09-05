import uuid
from datetime import datetime, timezone
from typing import List, Optional

import structlog
from models.workspace import ConceptModel, NodeModel, Workspace
from schemas.mastery import (
    ConceptCreate,
    ConceptMasteryDistribution,
    ConceptResponse,
    ConceptUpdate,
    WorkspaceMasterySummary,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

logger = structlog.get_logger()

DEFAULT_STALENESS_DAYS = 14


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_concept_response(concept: ConceptModel) -> ConceptResponse:
    node_ids = [n.id for n in concept.nodes] if concept.nodes else []
    return ConceptResponse(
        id=concept.id,
        workspace_id=concept.workspace_id,
        name=concept.name,
        description=concept.description,
        mastery_level=concept.mastery_level,
        confidence_score=round(concept.confidence_score, 4),
        times_quizzed=concept.times_quizzed,
        times_correct=concept.times_correct,
        last_reviewed_at=concept.last_reviewed_at,
        created_at=concept.created_at,
        updated_at=concept.updated_at,
        metadata=concept.metadata_payload or {},
        node_ids=node_ids,
    )


class MasteryService:
    """
    Service managing user knowledge profiles, concept mastery levels,
    and visual heatmap data.
    """

    @staticmethod
    async def get_workspace_mastery_summary(
        db: AsyncSession,
        workspace_id: str,
        staleness_days: int = DEFAULT_STALENESS_DAYS,
    ) -> WorkspaceMasterySummary:
        """
        Calculates and aggregates the mastery profile for a workspace,
        evaluating staleness and concept distribution.
        """
        stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(ConceptModel.workspace_id == workspace_id)
            .order_by(ConceptModel.name.asc())
        )
        result = await db.execute(stmt)
        concepts = list(result.scalars().all())

        now = _utc_now()
        dist = ConceptMasteryDistribution()
        total_score = 0.0
        responses: List[ConceptResponse] = []

        for c in concepts:
            # Check for staleness based on elapsed time since last review
            is_stale = False
            if (
                c.last_reviewed_at is not None
                and (now - c.last_reviewed_at).days >= staleness_days
                and c.mastery_level in ("mastered", "quizzed", "explored")
            ):
                is_stale = True

            effective_level = "stale" if is_stale else c.mastery_level

            # Update distribution
            if effective_level == "mastered":
                dist.mastered += 1
            elif effective_level == "quizzed":
                dist.quizzed += 1
            elif effective_level == "explored":
                dist.explored += 1
            elif effective_level == "stale":
                dist.stale += 1
            else:
                dist.unexplored += 1

            total_score += c.confidence_score
            responses.append(_to_concept_response(c))

        total_count = len(concepts)
        overall_score = round(total_score / total_count, 4) if total_count > 0 else 0.0

        # Top mastered concepts (highest confidence, mastered status)
        top_mastered = sorted(
            [r for r in responses if r.mastery_level == "mastered" or r.confidence_score >= 0.8],
            key=lambda x: x.confidence_score,
            reverse=True,
        )[:5]

        # Concepts needing review (stale, low confidence, or tested incorrectly)
        needing_review = sorted(
            [
                r
                for r in responses
                if r.mastery_level in ("stale", "explored", "quizzed")
                and r.confidence_score < 0.8
            ],
            key=lambda x: (x.confidence_score, x.last_reviewed_at or datetime.min.replace(tzinfo=timezone.utc)),
        )[:5]

        return WorkspaceMasterySummary(
            workspace_id=workspace_id,
            total_concepts=total_count,
            overall_score=overall_score,
            distribution=dist,
            top_mastered=top_mastered,
            needing_review=needing_review,
            concepts=responses,
        )

    @staticmethod
    async def get_workspace_concepts(
        db: AsyncSession,
        workspace_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> List[ConceptResponse]:
        """
        List concepts for a workspace with pagination.
        """
        stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(ConceptModel.workspace_id == workspace_id)
            .order_by(ConceptModel.name.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [_to_concept_response(c) for c in result.scalars().all()]

    @staticmethod
    async def get_concept(
        db: AsyncSession,
        concept_id: str,
    ) -> Optional[ConceptResponse]:
        """
        Fetch a single concept by ID.
        """
        stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(ConceptModel.id == concept_id)
        )
        result = await db.execute(stmt)
        concept = result.scalar_one_or_none()
        if not concept:
            return None
        return _to_concept_response(concept)

    @staticmethod
    async def create_or_get_concept(
        db: AsyncSession,
        workspace_id: str,
        data: ConceptCreate,
    ) -> ConceptResponse:
        """
        Create a new concept or return existing concept with same name in workspace.
        Optionally links provided node IDs.
        """
        # Check if workspace exists
        ws_stmt = select(Workspace).where(Workspace.id == workspace_id)
        ws_res = await db.execute(ws_stmt)
        if not ws_res.scalar_one_or_none():
            raise ValueError(f"Workspace '{workspace_id}' not found")

        # Check for existing concept by name
        clean_name = data.name.strip()
        stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(
                ConceptModel.workspace_id == workspace_id,
                func.lower(ConceptModel.name) == clean_name.lower(),
            )
        )
        result = await db.execute(stmt)
        concept = result.scalar_one_or_none()

        if concept:
            # Concept already exists; link new nodes if any
            if data.node_ids:
                existing_node_ids = {n.id for n in concept.nodes}
                new_node_ids = [nid for nid in data.node_ids if nid not in existing_node_ids]
                if new_node_ids:
                    nodes_stmt = select(NodeModel).where(
                        NodeModel.id.in_(new_node_ids),
                        NodeModel.workspace_id == workspace_id,
                    )
                    nodes_res = await db.execute(nodes_stmt)
                    concept.nodes.extend(nodes_res.scalars().all())
                    await db.flush()
            return _to_concept_response(concept)

        # Create new concept
        concept_id = data.id or f"concept_{uuid.uuid4().hex[:12]}"
        concept = ConceptModel(
            id=concept_id,
            workspace_id=workspace_id,
            name=clean_name,
            description=data.description,
            mastery_level=data.mastery_level,
            confidence_score=data.confidence_score,
            times_quizzed=data.times_quizzed,
            times_correct=data.times_correct,
            last_reviewed_at=_utc_now(),
            metadata_payload=data.metadata or {},
        )

        if data.node_ids:
            nodes_stmt = select(NodeModel).where(
                NodeModel.id.in_(data.node_ids),
                NodeModel.workspace_id == workspace_id,
            )
            nodes_res = await db.execute(nodes_stmt)
            concept.nodes = list(nodes_res.scalars().all())

        db.add(concept)
        await db.flush()
        await db.refresh(concept, ["nodes"])
        logger.info("Created concept", concept_id=concept.id, name=concept.name, workspace_id=workspace_id)
        return _to_concept_response(concept)

    @staticmethod
    async def update_concept(
        db: AsyncSession,
        concept_id: str,
        data: ConceptUpdate,
    ) -> Optional[ConceptResponse]:
        """
        Update concept fields, or register quiz feedback with automatic mastery score recalculation.
        """
        stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(ConceptModel.id == concept_id)
        )
        result = await db.execute(stmt)
        concept = result.scalar_one_or_none()
        if not concept:
            return None

        # Process quiz result feedback
        if data.quiz_result is not None:
            concept.times_quizzed += 1
            if data.quiz_result:
                concept.times_correct += 1

            # Recalculate confidence score
            score = concept.times_correct / concept.times_quizzed
            concept.confidence_score = round(score, 4)

            # Auto-assign mastery level based on quiz performance
            if concept.confidence_score >= 0.8 and concept.times_quizzed >= 2:
                concept.mastery_level = "mastered"
            elif concept.confidence_score >= 0.5:
                concept.mastery_level = "quizzed"
            elif concept.confidence_score > 0.0:
                concept.mastery_level = "explored"
            else:
                concept.mastery_level = "explored"

            concept.last_reviewed_at = _utc_now()

        # Explicit confidence score update
        if data.confidence_score is not None:
            concept.confidence_score = data.confidence_score
            concept.last_reviewed_at = _utc_now()
            if data.mastery_level is None:
                if concept.confidence_score >= 0.8:
                    concept.mastery_level = "mastered"
                elif concept.confidence_score >= 0.5:
                    concept.mastery_level = "quizzed"
                elif concept.confidence_score > 0.0:
                    concept.mastery_level = "explored"
                else:
                    concept.mastery_level = "unexplored"

        if data.mastery_level is not None:
            concept.mastery_level = data.mastery_level
        if data.name is not None:
            concept.name = data.name.strip()
        if data.description is not None:
            concept.description = data.description
        if data.times_quizzed is not None:
            concept.times_quizzed = data.times_quizzed
        if data.times_correct is not None:
            concept.times_correct = data.times_correct
        if data.metadata is not None:
            merged = {**(concept.metadata_payload or {}), **data.metadata}
            concept.metadata_payload = merged

        await db.flush()
        return _to_concept_response(concept)

    @staticmethod
    async def link_node_concepts(
        db: AsyncSession,
        node_id: str,
        concept_ids: List[str],
    ) -> List[ConceptResponse]:
        """
        Link a conversation node to one or more concepts.
        """
        node_stmt = (
            select(NodeModel)
            .options(selectinload(NodeModel.concepts))
            .where(NodeModel.id == node_id)
        )
        node_res = await db.execute(node_stmt)
        node = node_res.scalar_one_or_none()
        if not node:
            raise ValueError(f"Node '{node_id}' not found")

        # Fetch concepts
        concepts_stmt = (
            select(ConceptModel)
            .options(selectinload(ConceptModel.nodes))
            .where(
                ConceptModel.id.in_(concept_ids),
                ConceptModel.workspace_id == node.workspace_id,
            )
        )
        concepts_res = await db.execute(concepts_stmt)
        concepts = list(concepts_res.scalars().all())

        existing_concept_ids = {c.id for c in node.concepts}
        for c in concepts:
            if c.id not in existing_concept_ids:
                node.concepts.append(c)

        await db.flush()
        logger.info("Linked node to concepts", node_id=node_id, count=len(concepts))
        return [_to_concept_response(c) for c in concepts]

    @staticmethod
    async def get_node_concepts(
        db: AsyncSession,
        node_id: str,
    ) -> List[ConceptResponse]:
        """
        Fetch all concepts associated with a given node.
        """
        node_stmt = (
            select(NodeModel)
            .options(
                selectinload(NodeModel.concepts).selectinload(ConceptModel.nodes)
            )
            .where(NodeModel.id == node_id)
        )
        node_res = await db.execute(node_stmt)
        node = node_res.scalar_one_or_none()
        if not node:
            return []
        return [_to_concept_response(c) for c in node.concepts]

    @staticmethod
    async def delete_concept(
        db: AsyncSession,
        concept_id: str,
    ) -> bool:
        """
        Delete a concept by ID.
        """
        stmt = select(ConceptModel).where(ConceptModel.id == concept_id)
        result = await db.execute(stmt)
        concept = result.scalar_one_or_none()
        if not concept:
            return False
        await db.delete(concept)
        await db.flush()
        logger.info("Deleted concept", concept_id=concept_id)
        return True
