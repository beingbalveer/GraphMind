from typing import Literal

import structlog
from models.roadmap import (
    ChoiceSelection,
    CurriculumItem,
    CurriculumRelation,
    CurriculumRevision,
    KnowledgeCheck,
    ResearchSource,
    RevisionItem,
    RevisionSource,
    Roadmap,
    TopicChat,
    TopicProgress,
    TopicResource,
    WeeklyAssignment,
    new_id,
)
from models.workspace import NodeModel, Workspace
from schemas.curriculum import (
    ChoiceData,
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumRelationData,
    CurriculumView,
    KnowledgeCheckData,
    LearningProfile,
    ResourceData,
    SourceData,
    TopicBrief,
    TopicProgressData,
    TopicResourceView,
    ValidationReport,
    WeeklySession,
)
from services.roadmap.validation import validate_curriculum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class CurriculumRepository:
    """Owns no transaction: publication, edit and tutor services commit atomically."""

    def __init__(self, session: AsyncSession, reader_id: str | None = None) -> None:
        self.session = session
        self.reader_id = reader_id

    async def _identities(
        self, roadmap_id: str, candidate: CurriculumCandidate, sources: list[SourceData]
    ) -> None:
        for item in candidate.items:
            existing = await self.session.get(CurriculumItem, item.id)
            if existing is not None and existing.roadmap_id != roadmap_id:
                raise ValueError("ITEM_OWNERSHIP_MISMATCH")
        for source in sources:
            existing_source = await self.session.get(ResearchSource, source.id)
            if existing_source is not None:
                if existing_source.roadmap_id != roadmap_id:
                    raise ValueError("SOURCE_OWNERSHIP_MISMATCH")
                if existing_source.payload != source.model_dump(mode="json"):
                    raise ValueError("SOURCE_IMMUTABLE")

    def _check_validation(
        self,
        candidate: CurriculumCandidate,
        profile: LearningProfile,
        sources: list[SourceData],
        validation: ValidationReport,
        *,
        allow_manual_warnings: bool = False,
    ) -> None:
        manual = allow_manual_warnings and any(
            issue.severity == "warning"
            and issue.code
            in {
                "CAPACITY_EXCEEDED",
                "WEEKLY_CAPACITY",
                "SESSION_DURATION",
            }
            for issue in validation.issues
        )
        actual = validate_curriculum(candidate, profile, sources, manual=manual)
        if (
            not validation.valid
            or not actual.valid
            or actual.core_minutes != validation.core_minutes
            or actual.capacity_minutes != validation.capacity_minutes
        ):
            raise ValueError("UNVALIDATED_CURRICULUM")

    async def create(
        self,
        owner_id: str,
        workspace_id: str,
        anchor_id: str,
        profile: LearningProfile,
        candidate: CurriculumCandidate,
        sources: list[SourceData],
        validation: ValidationReport,
    ) -> CurriculumView:
        workspace = await self.session.get(Workspace, workspace_id)
        anchor = await self.session.get(NodeModel, anchor_id)
        if (
            workspace is None
            or workspace.owner_id != owner_id
            or anchor is None
            or anchor.workspace_id != workspace_id
            or anchor.parent_id is not None
        ):
            raise ValueError("ANCHOR_OWNERSHIP_MISMATCH")
        self._check_validation(candidate, profile, sources, validation)
        roadmap = Roadmap(
            id=new_id("roadmap"),
            owner_id=owner_id,
            workspace_id=workspace_id,
            canvas_anchor_chat_id=anchor_id,
            profile=profile.model_dump(mode="json"),
        )
        await self._identities(roadmap.id, candidate, sources)
        self.session.add(roadmap)
        await self.session.flush()
        await self._write_revision(roadmap, None, candidate, sources, validation, "active")
        view = await self.read(workspace_id)
        assert view is not None
        return view

    async def save_revision(
        self,
        roadmap_id: str,
        base_revision_id: str,
        candidate: CurriculumCandidate,
        sources: list[SourceData],
        validation: ValidationReport,
        status: Literal["candidate", "active"],
    ) -> str:
        roadmap = await self.session.scalar(
            select(Roadmap)
            .where(Roadmap.id == roadmap_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if roadmap is None:
            raise ValueError("ROADMAP_NOT_FOUND")
        base = await self.session.get(CurriculumRevision, base_revision_id)
        if base is None or base.roadmap_id != roadmap_id:
            raise ValueError("REVISION_OWNERSHIP_MISMATCH")
        if status == "active" and roadmap.current_revision_id != base_revision_id:
            raise ValueError("REVISION_CONFLICT")
        self._check_validation(
            candidate,
            LearningProfile.model_validate(roadmap.profile),
            sources,
            validation,
            allow_manual_warnings=status == "active",
        )
        await self._identities(roadmap.id, candidate, sources)
        return await self._write_revision(
            roadmap, base_revision_id, candidate, sources, validation, status
        )

    async def _write_revision(
        self,
        roadmap: Roadmap,
        base_id: str | None,
        candidate: CurriculumCandidate,
        sources: list[SourceData],
        validation: ValidationReport,
        status: Literal["candidate", "active"],
    ) -> str:
        revision_id = new_id("rev")
        revision = CurriculumRevision(
            id=revision_id,
            roadmap_id=roadmap.id,
            base_revision_id=base_id,
            status=status,
            title=candidate.title,
            outcome=candidate.outcome,
            assumptions=candidate.assumptions,
            core_minutes=validation.core_minutes,
            validation=validation.model_dump(mode="json"),
        )
        self.session.add(revision)
        for item in candidate.items:
            if await self.session.get(CurriculumItem, item.id) is None:
                self.session.add(CurriculumItem(id=item.id, roadmap_id=roadmap.id))
        for source in sources:
            if await self.session.get(ResearchSource, source.id) is None:
                self.session.add(
                    ResearchSource(
                        id=source.id,
                        roadmap_id=roadmap.id,
                        owner_id=roadmap.owner_id,
                        reference_id=source.reference_id,
                        url=source.url,
                        payload=source.model_dump(mode="json"),
                    )
                )
        await self.session.flush()
        for ordinal, item in enumerate(candidate.items):
            self.session.add(
                RevisionItem(
                    revision_id=revision.id,
                    roadmap_id=roadmap.id,
                    item_id=item.id,
                    kind=item.kind,
                    position=item.order,
                    path=item.path,
                    participation=item.participation,
                    estimate_minutes=item.estimate_minutes,
                    payload=item.model_dump(mode="json"),
                    ordinal=ordinal,
                )
            )
        for ordinal, source in enumerate(sources):
            self.session.add(
                RevisionSource(
                    revision_id=revision.id,
                    source_id=source.id,
                    roadmap_id=roadmap.id,
                    ordinal=ordinal,
                )
            )
        await self.session.flush()
        for ordinal, relation in enumerate(candidate.relations):
            self.session.add(
                CurriculumRelation(
                    revision_id=revision.id,
                    source_id=relation.source_id,
                    target_id=relation.target_id,
                    kind=relation.kind,
                    ordinal=ordinal,
                )
            )
        for ordinal, choice in enumerate(candidate.choices):
            self.session.add(
                ChoiceSelection(
                    revision_id=revision.id,
                    choice_id=choice.choice_id,
                    selected_id=choice.selected_id,
                    rationale=choice.rationale,
                    ordinal=ordinal,
                )
            )
        for ordinal, assignment in enumerate(candidate.sessions):
            self.session.add(
                WeeklyAssignment(
                    revision_id=revision.id,
                    week=assignment.week,
                    topic_id=assignment.topic_id,
                    sequence=assignment.sequence,
                    minutes=assignment.minutes,
                    ordinal=ordinal,
                )
            )
        for ordinal, resource in enumerate(candidate.resources):
            self.session.add(
                TopicResource(
                    revision_id=revision.id,
                    roadmap_id=roadmap.id,
                    topic_id=resource.topic_id,
                    source_id=resource.source_id,
                    position=resource.order,
                    rationale=resource.rationale,
                    ordinal=ordinal,
                )
            )
        if status == "active":
            if roadmap.current_revision_id:
                previous = await self.session.get(CurriculumRevision, roadmap.current_revision_id)
                if previous is not None:
                    previous.status = "archived"
            roadmap.current_revision_id = revision.id
        await self.session.flush()
        logger.info(
            "Curriculum revision saved",
            roadmap_id=roadmap.id,
            revision_id=revision.id,
            status=status,
            item_count=len(candidate.items),
        )
        return revision_id

    async def read(self, workspace_id: str) -> CurriculumView | None:
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.workspace_id == workspace_id)
        )
        if roadmap is None or not roadmap.current_revision_id:
            return None
        return await self.read_revision(roadmap.id, roadmap.current_revision_id)

    async def read_revision(self, roadmap_id: str, revision_id: str) -> CurriculumView:
        roadmap = await self.session.get(Roadmap, roadmap_id)
        revision = await self.session.get(CurriculumRevision, revision_id)
        if roadmap is None or revision is None or revision.roadmap_id != roadmap_id:
            raise ValueError("REVISION_NOT_FOUND")
        items = list(
            (
                await self.session.scalars(
                    select(RevisionItem)
                    .where(RevisionItem.revision_id == revision_id)
                    .order_by(RevisionItem.ordinal)
                )
            ).all()
        )
        relations = (
            await self.session.scalars(
                select(CurriculumRelation)
                .where(CurriculumRelation.revision_id == revision_id)
                .order_by(CurriculumRelation.ordinal)
            )
        ).all()
        choices = (
            await self.session.scalars(
                select(ChoiceSelection)
                .where(ChoiceSelection.revision_id == revision_id)
                .order_by(ChoiceSelection.ordinal)
            )
        ).all()
        assignments = (
            await self.session.scalars(
                select(WeeklyAssignment)
                .where(WeeklyAssignment.revision_id == revision_id)
                .order_by(WeeklyAssignment.ordinal)
            )
        ).all()
        resources = (
            await self.session.scalars(
                select(TopicResource)
                .where(TopicResource.revision_id == revision_id)
                .order_by(TopicResource.ordinal)
            )
        ).all()
        sources = (
            await self.session.scalars(
                select(ResearchSource)
                .join(
                    RevisionSource,
                    (RevisionSource.source_id == ResearchSource.id)
                    & (RevisionSource.roadmap_id == ResearchSource.roadmap_id),
                )
                .where(RevisionSource.revision_id == revision_id)
                .order_by(RevisionSource.ordinal)
            )
        ).all()
        progress = (
            await self.session.scalars(
                select(TopicProgress).where(
                    TopicProgress.roadmap_id == roadmap_id,
                    TopicProgress.owner_id == (self.reader_id or roadmap.owner_id),
                )
            )
        ).all()
        progress_map = {
            p.topic_id: TopicProgressData.model_validate(
                {"topic_id": p.topic_id, "status": p.status, "completed_at": p.completed_at}
            )
            for p in progress
        }
        for item in items:
            if item.kind == "topic":
                progress_map.setdefault(item.item_id, TopicProgressData(topic_id=item.item_id))
        candidate = CurriculumCandidate(
            title=revision.title,
            outcome=revision.outcome,
            assumptions=revision.assumptions,
            items=[CurriculumItemData.model_validate(i.payload) for i in items],
            relations=[
                CurriculumRelationData.model_validate(
                    {"source_id": r.source_id, "target_id": r.target_id, "kind": r.kind}
                )
                for r in relations
            ],
            choices=[
                ChoiceData(choice_id=c.choice_id, selected_id=c.selected_id, rationale=c.rationale)
                for c in choices
            ],
            sessions=[
                WeeklySession(
                    week=a.week, topic_id=a.topic_id, sequence=a.sequence, minutes=a.minutes
                )
                for a in assignments
            ],
            resources=[
                ResourceData(
                    topic_id=r.topic_id,
                    source_id=r.source_id,
                    order=r.position,
                    rationale=r.rationale,
                )
                for r in resources
            ],
        )
        return CurriculumView(
            roadmap_id=roadmap.id,
            workspace_id=roadmap.workspace_id,
            canvas_anchor_chat_id=roadmap.canvas_anchor_chat_id,
            revision_id=revision_id,
            profile=LearningProfile.model_validate(roadmap.profile),
            candidate=candidate,
            sources=[SourceData.model_validate(s.payload) for s in sources],
            progress=progress_map,
            validation=ValidationReport.model_validate(revision.validation),
        )

    async def read_brief(self, workspace_id: str, topic_id: str) -> TopicBrief:
        view = await self.read(workspace_id)
        if view is None:
            raise ValueError("ROADMAP_NOT_FOUND")
        item = next(
            (i for i in view.candidate.items if i.id == topic_id and i.kind == "topic"), None
        )
        if item is None:
            raise ValueError("TOPIC_NOT_FOUND")
        roadmap = await self.session.get(Roadmap, view.roadmap_id)
        assert roadmap is not None
        owner_id = self.reader_id or roadmap.owner_id
        default_chat = await self.session.scalar(
            select(TopicChat.chat_id).where(
                TopicChat.roadmap_id == view.roadmap_id,
                TopicChat.topic_id == topic_id,
                TopicChat.owner_id == owner_id,
                TopicChat.default_key.is_not(None),
            )
        )
        latest = await self.session.scalar(
            select(KnowledgeCheck)
            .where(
                KnowledgeCheck.roadmap_id == view.roadmap_id,
                KnowledgeCheck.topic_id == topic_id,
                KnowledgeCheck.owner_id == owner_id,
            )
            .order_by(KnowledgeCheck.created_at.desc())
            .limit(1)
        )
        source_map = {source.id: source for source in view.sources}
        prerequisites = {
            r.source_id
            for r in view.candidate.relations
            if r.kind == "prerequisite" and r.target_id == topic_id
        }
        return TopicBrief(
            item=item,
            resources=[
                TopicResourceView(
                    source=source_map[r.source_id], rationale=r.rationale, order=r.order
                )
                for r in view.candidate.resources
                if r.topic_id == topic_id
            ],
            prerequisites=[i for i in view.candidate.items if i.id in prerequisites],
            progress=view.progress[topic_id],
            default_chat_id=default_chat,
            latest_check=KnowledgeCheckData.model_validate(latest) if latest else None,
        )
