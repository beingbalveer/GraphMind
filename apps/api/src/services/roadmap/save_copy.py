"""Transactional save-copy of a published public snapshot (LSI-028).

This is the signed-in half of the LSI-002 §4 boundary: a learner saves one
*published* public snapshot into an authorized workspace, and the service
materializes an independent private workspace curriculum/revision from the
frozen public content. It deliberately owns no commit: the route's request
transaction commits (or rolls back) the anchor, roadmap, revision, copy, and
topic map together, so a failure leaves no orphan anchor, roadmap, or copy.

Guarantees enforced here:

* Only ``status = 'published'`` snapshots are copyable
  (``SNAPSHOT_OBSOLETE``); an unpublished or unknown version is rejected.
* A workspace may hold at most one roadmap, so a copy into an already-populated
  workspace with a *different* template is a conflict (``WORKSPACE_HAS_ROADMAP``).
* Saving is idempotent per ``(workspace_id, template_id)``: a retry returns the
  existing private copy rather than creating a duplicate. The ``(workspace_id,
  idempotency_key)`` constraint rejects a key reused for a different template
  (``IDEMPOTENCY_MISMATCH``).
* Private topic IDs are newly generated (deterministically namespaced to the
  workspace/template/version), so a copy is independent of every other copy and
  of the public identity. The public-topic → private-topic map is persisted for
  later intent resumption (LSI-031/LSI-032).
* Public snapshots are never mutated or deleted; a copy is a pure projection.
"""

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import cast

from models.public_snapshot import (
    PublicSnapshot,
    PublicSnapshotPhase,
    PublicSnapshotSource,
    PublicSnapshotTopic,
    PublicSnapshotTopicSource,
)
from models.public_snapshot_copy import PublicSnapshotCopy, PublicSnapshotCopyTopic
from models.roadmap import Roadmap, new_id
from models.workspace import NodeModel, Workspace
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumRelationData,
    LearningProfile,
    ResourceData,
    SourceData,
)
from schemas.enrollment import EnrollmentDetail, EnrollmentTopicMap, SaveRoadmapCopyRequest
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.validation import validate_curriculum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

HALF_HOUR = Decimal("0.5")


class SaveCopyError(ValueError):
    """A structured, private-safe save-copy failure with an HTTP status."""

    def __init__(
        self, code: str, message: str, *, status: int = 400, detail: list[str] | None = None
    ) -> None:
        self.code = code
        self.message = message
        self.status = status
        self.detail = detail or []
        super().__init__(message)


@dataclass(frozen=True)
class _SnapshotRows:
    phases: list[PublicSnapshotPhase]
    topics: list[PublicSnapshotTopic]
    sources: list[PublicSnapshotSource]
    links: list[PublicSnapshotTopicSource]


class SaveCopyService:
    """Owns no commit: the request transaction makes a copy atomic."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def save(
        self,
        actor_id: str,
        workspace_id: str,
        request: SaveRoadmapCopyRequest,
        idempotency_key: str,
    ) -> tuple[EnrollmentDetail, bool]:
        """Create the copy or return the existing one. Returns ``(detail, created)``."""
        workspace = await self.session.scalar(
            select(Workspace).where(Workspace.id == workspace_id).with_for_update()
        )
        if workspace is None:
            raise SaveCopyError("WORKSPACE_NOT_FOUND", "Workspace not found", status=404)
        source_ref = f"{request.template_id}:{request.snapshot_version}"

        existing = await self.session.scalar(
            select(PublicSnapshotCopy).where(
                PublicSnapshotCopy.workspace_id == workspace_id,
                PublicSnapshotCopy.template_id == request.template_id,
            )
        )
        if existing is not None:
            return await self._existing_detail(existing, actor_id), False

        snapshot = await self.session.scalar(
            select(PublicSnapshot).where(
                PublicSnapshot.template_id == request.template_id,
                PublicSnapshot.snapshot_version == request.snapshot_version,
                PublicSnapshot.status == "published",
            )
        )
        if snapshot is None:
            raise SaveCopyError(
                "SNAPSHOT_OBSOLETE", "Template snapshot version is obsolete", status=400
            )

        key_row = await self.session.scalar(
            select(PublicSnapshotCopy).where(
                PublicSnapshotCopy.workspace_id == workspace_id,
                PublicSnapshotCopy.idempotency_key == idempotency_key,
            )
        )
        if key_row is not None:
            raise SaveCopyError(
                "IDEMPOTENCY_MISMATCH",
                "This idempotency key was already used for a different template",
                status=409,
            )

        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id)
        )
        if roadmap is not None:
            raise SaveCopyError(
                "WORKSPACE_HAS_ROADMAP",
                "This workspace already contains a different learning roadmap",
                status=409,
            )

        rows = await self._load_rows(snapshot.id)
        candidate, profile, sources, topic_pairs = self._build(
            snapshot, rows, workspace_id, request, source_ref
        )
        validation = validate_curriculum(candidate, profile, sources)
        if not validation.valid:
            raise SaveCopyError(
                "SNAPSHOT_NOT_COPYABLE",
                "This template cannot be saved right now",
                status=409,
                detail=[issue.code for issue in validation.issues if issue.severity == "error"],
            )

        anchor = NodeModel(
            id=new_id("node"),
            workspace_id=workspace_id,
            role="system",
            content=candidate.title,
            metadata_payload={
                "kind": "roadmap_anchor",
                "title": candidate.title,
                "sourceSnapshotRef": source_ref,
            },
        )
        self.session.add(anchor)
        await self.session.flush()

        view = await CurriculumRepository(self.session, reader_id=actor_id).create(
            workspace.owner_id,
            workspace_id,
            anchor.id,
            profile,
            candidate,
            sources,
            validation,
        )

        copy = PublicSnapshotCopy(
            id=new_id("copy"),
            workspace_id=workspace_id,
            template_id=request.template_id,
            snapshot_version=request.snapshot_version,
            snapshot_id=snapshot.id,
            roadmap_id=view.roadmap_id,
            revision_id=view.revision_id,
            idempotency_key=idempotency_key,
        )
        self.session.add(copy)
        await self.session.flush()
        for position, (public_topic_id, private_topic_id) in enumerate(topic_pairs):
            self.session.add(
                PublicSnapshotCopyTopic(
                    copy_id=copy.id,
                    public_topic_id=public_topic_id,
                    private_topic_id=private_topic_id,
                    position=position,
                )
            )
        anchor.metadata_payload = {**anchor.metadata_payload, "roadmapId": view.roadmap_id}
        await self.session.flush()

        return (
            EnrollmentDetail(
                roadmap_id=view.roadmap_id,
                workspace_id=workspace_id,
                revision_id=view.revision_id,
                source_snapshot_ref=source_ref,
                title=candidate.title,
                created_at=copy.created_at,
                updated_at=copy.updated_at,
                topic_progress=view.progress,
                topic_map=[
                    EnrollmentTopicMap(public_topic_id=public, private_topic_id=private)
                    for public, private in topic_pairs
                ],
            ),
            True,
        )

    async def _existing_detail(self, copy: PublicSnapshotCopy, actor_id: str) -> EnrollmentDetail:
        roadmap = await self.session.get(Roadmap, copy.roadmap_id)
        if roadmap is None or not roadmap.current_revision_id:
            raise SaveCopyError("COPY_NOT_FOUND", "Saved copy not found", status=404)
        repository = CurriculumRepository(self.session, reader_id=actor_id)
        try:
            view = await repository.read_revision(copy.roadmap_id, roadmap.current_revision_id)
        except ValueError:
            raise SaveCopyError("COPY_NOT_FOUND", "Saved copy not found", status=404) from None
        maps = (
            await self.session.scalars(
                select(PublicSnapshotCopyTopic)
                .where(PublicSnapshotCopyTopic.copy_id == copy.id)
                .order_by(PublicSnapshotCopyTopic.position)
            )
        ).all()
        return EnrollmentDetail(
            roadmap_id=copy.roadmap_id,
            workspace_id=copy.workspace_id,
            revision_id=view.revision_id,
            source_snapshot_ref=f"{copy.template_id}:{copy.snapshot_version}",
            title=view.candidate.title,
            created_at=copy.created_at,
            updated_at=copy.updated_at,
            topic_progress=view.progress,
            topic_map=[
                EnrollmentTopicMap(
                    public_topic_id=row.public_topic_id, private_topic_id=row.private_topic_id
                )
                for row in maps
            ],
        )

    async def _load_rows(self, snapshot_id: str) -> _SnapshotRows:
        phases = list(
            (
                await self.session.scalars(
                    select(PublicSnapshotPhase)
                    .where(PublicSnapshotPhase.snapshot_id == snapshot_id)
                    .order_by(PublicSnapshotPhase.position)
                )
            ).all()
        )
        topics = list(
            (
                await self.session.scalars(
                    select(PublicSnapshotTopic)
                    .where(PublicSnapshotTopic.snapshot_id == snapshot_id)
                    .order_by(PublicSnapshotTopic.position)
                )
            ).all()
        )
        sources = list(
            (
                await self.session.scalars(
                    select(PublicSnapshotSource)
                    .where(PublicSnapshotSource.snapshot_id == snapshot_id)
                    .order_by(PublicSnapshotSource.position)
                )
            ).all()
        )
        links = list(
            (
                await self.session.scalars(
                    select(PublicSnapshotTopicSource)
                    .where(PublicSnapshotTopicSource.snapshot_id == snapshot_id)
                    .order_by(
                        PublicSnapshotTopicSource.topic_id, PublicSnapshotTopicSource.position
                    )
                )
            ).all()
        )
        return _SnapshotRows(phases=phases, topics=topics, sources=sources, links=links)

    def _build(
        self,
        snapshot: PublicSnapshot,
        rows: _SnapshotRows,
        workspace_id: str,
        request: SaveRoadmapCopyRequest,
        source_ref: str,
    ) -> tuple[CurriculumCandidate, LearningProfile, list[SourceData], list[tuple[str, str]]]:
        """Project the frozen public rows into a fresh, valid private curriculum."""

        def private_id(prefix: str, public_id: str) -> str:
            digest = uuid.uuid5(
                uuid.NAMESPACE_URL,
                "graphmind:copy:"
                f"{workspace_id}:{snapshot.template_id}:{snapshot.snapshot_version}:{public_id}",
            ).hex
            return f"{prefix}_{digest}"

        root_id = private_id("item", "root")
        phase_ids = {
            phase.phase_id: private_id("item", f"phase:{phase.phase_id}") for phase in rows.phases
        }
        topic_ids = {
            topic.topic_id: private_id("item", f"topic:{topic.topic_id}") for topic in rows.topics
        }
        source_ids = {
            source.source_id: private_id("src", f"source:{source.source_id}")
            for source in rows.sources
        }

        title = request.custom_title or snapshot.title
        summary = (snapshot.summary or "").strip()
        outcome = summary or snapshot.title
        prompt = summary if len(summary) >= 10 else f"Study the {snapshot.title} roadmap"
        raw_hours = Decimal(str(snapshot.hours_per_week))
        # Keep the shared profile contract (half-hour pacing) rather than
        # silently altering the frozen public value.
        hours: Decimal | None = raw_hours if raw_hours % HALF_HOUR == 0 else None
        profile = LearningProfile(
            title=title,
            prompt=prompt,
            level=cast("object", snapshot.level),
            background=None,
            duration=None,
            hours_per_week=hours,
            outcome=outcome,
            study_weeks=snapshot.estimated_weeks,
            weekly_minutes=None,
            assumptions=[],
            known_skills=[],
            source_snapshot_ref=source_ref,
        )

        items: list[CurriculumItemData] = [
            CurriculumItemData(
                id=root_id, kind="root", title=title, order=0, path="core", participation="active"
            )
        ]
        for phase in rows.phases:
            items.append(
                CurriculumItemData(
                    id=phase_ids[phase.phase_id],
                    kind="phase",
                    title=phase.title,
                    order=phase.position,
                    path=cast("object", phase.path),
                    participation="active",
                )
            )
        for topic in rows.topics:
            items.append(
                CurriculumItemData(
                    id=topic_ids[topic.topic_id],
                    kind="topic",
                    title=topic.title,
                    brief=topic.brief,
                    objectives=list(topic.objectives),
                    exercise=topic.exercise,
                    format=cast("object", topic.format),
                    order=topic.position,
                    path=cast("object", topic.path),
                    estimate_minutes=topic.estimate_minutes,
                    participation="active",
                    content_markdown=topic.content_markdown,
                )
            )

        relations: list[CurriculumRelationData] = [
            CurriculumRelationData(
                source_id=root_id, target_id=phase_ids[phase.phase_id], kind="contains"
            )
            for phase in rows.phases
        ]
        for topic in rows.topics:
            relations.append(
                CurriculumRelationData(
                    source_id=phase_ids[topic.phase_id],
                    target_id=topic_ids[topic.topic_id],
                    kind="contains",
                )
            )
            for prerequisite in topic.prerequisites:
                if prerequisite in topic_ids:
                    relations.append(
                        CurriculumRelationData(
                            source_id=topic_ids[prerequisite],
                            target_id=topic_ids[topic.topic_id],
                            kind="prerequisite",
                        )
                    )

        sources = [
            SourceData(
                id=source_ids[source.source_id],
                title=source.title,
                url=source.url,
                reference_id=f"public:{snapshot.template_id}:{source.source_id}",
                locator=source.locator,
                verified_at=snapshot.published_at,
                status="grounded",
                access="unknown",
                kind=source.kind,
                evidence=f"Vetted public reference in {snapshot.title}: {source.title}",
                provenance={},
            )
            for source in rows.sources
        ]

        titles = {topic.topic_id: topic.title for topic in rows.topics}
        resources = [
            ResourceData(
                topic_id=topic_ids[link.topic_id],
                source_id=source_ids[link.source_id],
                order=link.position,
                rationale=f"Recommended reference for {titles[link.topic_id]}.",
            )
            for link in rows.links
            if link.topic_id in topic_ids and link.source_id in source_ids
        ]

        candidate = CurriculumCandidate(
            title=title,
            outcome=outcome,
            assumptions=[],
            items=items,
            relations=relations,
            choices=[],
            sessions=[],
            resources=resources,
        )
        topic_pairs = [(topic.topic_id, topic_ids[topic.topic_id]) for topic in rows.topics]
        return candidate, profile, sources, topic_pairs
