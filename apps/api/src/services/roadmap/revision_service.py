"""Validate immutable curriculum changes without rewriting learner history."""

import structlog
from dependencies import require_workspace_read
from fastapi import HTTPException
from models.roadmap import (
    CurriculumItem,
    CurriculumRevision,
    KnowledgeCheck,
    ResearchSource,
    Roadmap,
    TopicChat,
    TopicProgress,
)
from models.user import User
from pydantic import ValidationError
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumRelationData,
    CurriculumView,
    SourceData,
    TopicProgressData,
    ValidationReport,
)
from schemas.roadmap_edit import ArchivedTopic, EditRequest, RevisionSummary
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.progress import ProgressService
from services.roadmap.tutor import TutorService
from services.roadmap.validation import validate_curriculum
from services.roadmap.workload import WorkloadError, schedule_core
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class RevisionConflictError(ValueError):
    pass


class HistoryRemovalRequiredError(ValueError):
    pass


class RevisionValidationError(ValueError):
    def __init__(
        self,
        report: ValidationReport | None = None,
        message: str = "These changes leave an invalid curriculum",
    ):
        self.report = report
        super().__init__(message)


class RevisionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _view(self, workspace_id: str, owner_id: str, write: bool = True) -> CurriculumView:
        if write:
            await ProgressService(self.session).authorize(workspace_id, owner_id)
        else:
            user = await self.session.get(User, owner_id)
            if user is None:
                raise HTTPException(404, "Learner not found")
            await require_workspace_read(workspace_id, user, self.session)
        view = await CurriculumRepository(self.session, owner_id).read(workspace_id)
        if view is None:
            raise HTTPException(404, "Roadmap not found")
        return view

    async def _has_history(self, roadmap_id: str, ids: set[str]) -> bool:
        if not ids:
            return False
        for model in (TopicProgress, TopicChat, KnowledgeCheck):
            terms = [model.roadmap_id == roadmap_id, model.topic_id.in_(ids)]
            if model is TopicProgress:
                terms.append(
                    or_(
                        TopicProgress.status != "not_started",
                        TopicProgress.completed_at.is_not(None),
                    )
                )
            if await self.session.scalar(select(exists().where(*terms))):
                return True
        return False

    async def _save(
        self,
        view: CurriculumView,
        owner_id: str,
        candidate: CurriculumCandidate,
        sources: list[SourceData],
        base_id: str,
        ack: bool,
    ) -> CurriculumView:
        roadmap = await self.session.scalar(
            select(Roadmap)
            .where(Roadmap.id == view.roadmap_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if roadmap is None:
            raise HTTPException(404, "Roadmap not found")
        if roadmap.current_revision_id != base_id:
            raise RevisionConflictError("Roadmap changed; reload before saving edits")
        await ProgressService(self.session).authorize(view.workspace_id, owner_id)
        removed = {i.id for i in view.candidate.items if i.participation == "active"} - {
            i.id for i in candidate.items if i.participation == "active"
        }
        if not ack and await self._has_history(view.roadmap_id, removed):
            raise HistoryRemovalRequiredError(
                "This topic has learning history. Removing it archives its lessons and progress."
            )
        try:
            candidate = CurriculumCandidate.model_validate(candidate.model_dump())
        except ValidationError:
            raise RevisionValidationError(
                message="Keep topic fields within the supported limits"
            ) from None
        report = validate_curriculum(candidate, view.profile, sources, manual=True)
        if not report.valid:
            raise RevisionValidationError(report)
        await CurriculumRepository(self.session, owner_id).save_revision(
            view.roadmap_id, base_id, candidate, sources, report, "active"
        )
        result = await CurriculumRepository(self.session, owner_id).read(view.workspace_id)
        assert result is not None
        logger.info(
            "curriculum_revision_applied",
            roadmap_id=view.roadmap_id,
            revision_id=result.revision_id,
        )
        return result

    async def edit(self, workspace_id: str, owner_id: str, request: EditRequest) -> CurriculumView:
        view = await self._view(workspace_id, owner_id)
        if view.revision_id != request.base_revision_id:
            raise RevisionConflictError("Roadmap changed; reload before saving edits")
        candidate = view.candidate.model_copy(deep=True)
        explicit_schedule = False
        for patch in request.patches:
            item = next(
                (i for i in candidate.items if i.id == getattr(patch, "item_id", None)), None
            )
            if (
                patch.op in {"update_item", "move_item", "remove_topic", "replace_resources"}
                and item is None
            ):
                raise RevisionValidationError(message="Topic is no longer in this plan")
            if patch.op == "update_item":
                assert item is not None
                for key, value in patch.model_dump(exclude_unset=True).items():
                    if key not in {"op", "item_id"}:
                        setattr(item, key, value)
                if item.kind == "root":
                    candidate.title = item.title
            elif patch.op == "add_topic":
                existing_identity = await self.session.get(CurriculumItem, patch.item.id)
                if (
                    patch.item.kind != "topic"
                    or existing_identity is not None
                    or any(i.id == patch.item.id for i in candidate.items)
                ):
                    raise RevisionValidationError(message="New topics require a new identity")
                candidate.items.append(patch.item.model_copy(deep=True))
                candidate.relations.append(
                    CurriculumRelationData(
                        source_id=patch.parent_id, target_id=patch.item.id, kind="contains"
                    )
                )
            elif patch.op == "remove_topic":
                assert item is not None
                if item.kind != "topic":
                    raise RevisionValidationError(message="Remove one learning topic at a time")
                candidate.items = [i for i in candidate.items if i.id != item.id]
                candidate.relations = [
                    r
                    for r in candidate.relations
                    if r.source_id != item.id and r.target_id != item.id
                ]
                candidate.resources = [r for r in candidate.resources if r.topic_id != item.id]
            elif patch.op == "move_item":
                assert item is not None
                parent = next((i for i in candidate.items if i.id == patch.parent_id), None)
                if item.kind == "root" or parent is None or parent.kind == "topic":
                    raise RevisionValidationError(message="Choose a containing phase or group")
                candidate.relations = [
                    r
                    for r in candidate.relations
                    if not (r.kind == "contains" and r.target_id == item.id)
                ]
                candidate.relations.append(
                    CurriculumRelationData(
                        source_id=patch.parent_id, target_id=item.id, kind="contains"
                    )
                )
                item.order = patch.order
            elif patch.op == "replace_resources":
                if any(r.topic_id != patch.item_id for r in patch.resources):
                    raise RevisionValidationError(
                        message="Resources must belong to the edited topic"
                    )
                candidate.resources = [
                    r for r in candidate.resources if r.topic_id != patch.item_id
                ] + patch.resources
            elif patch.op == "assign_week":
                candidate.sessions = patch.sessions
                explicit_schedule = True
            elif patch.op == "select_alternative":
                choice = next(
                    (c for c in candidate.choices if c.choice_id == patch.choice_id), None
                )
                if choice is None:
                    raise RevisionValidationError(message="Alternative group not found")
                choice.selected_id = patch.selected_id
        if not explicit_schedule:
            try:
                candidate.sessions = schedule_core(candidate, view.profile)
            except WorkloadError as error:
                raise RevisionValidationError(message=str(error)) from None
        sources = list(view.sources)
        known = {source.id for source in sources}
        for source_id in {r.source_id for r in candidate.resources} - known:
            row = await self.session.get(ResearchSource, source_id)
            if row is not None and row.roadmap_id == view.roadmap_id:
                sources.append(SourceData.model_validate(row.payload))
        return await self._save(
            view,
            owner_id,
            candidate,
            sources,
            request.base_revision_id,
            request.history_removal_ack,
        )

    async def apply(
        self,
        workspace_id: str,
        owner_id: str,
        revision_id: str,
        base_revision_id: str,
        history_removal_ack: bool = False,
    ) -> CurriculumView:
        view = await self._view(workspace_id, owner_id)
        revision = await self.session.get(CurriculumRevision, revision_id)
        if (
            revision is None
            or revision.roadmap_id != view.roadmap_id
            or revision.status != "candidate"
        ):
            raise HTTPException(404, "Proposal not found")
        if revision.base_revision_id != base_revision_id:
            raise RevisionConflictError("This proposal is based on an older revision")
        proposed = await CurriculumRepository(self.session, owner_id).read_revision(
            view.roadmap_id, revision_id
        )
        return await self._save(
            view,
            owner_id,
            proposed.candidate,
            proposed.sources,
            base_revision_id,
            history_removal_ack,
        )

    async def restore(
        self,
        workspace_id: str,
        owner_id: str,
        revision_id: str,
        base_revision_id: str,
        history_removal_ack: bool = False,
    ) -> CurriculumView:
        view = await self._view(workspace_id, owner_id)
        revision = await self.session.get(CurriculumRevision, revision_id)
        if (
            revision is None
            or revision.roadmap_id != view.roadmap_id
            or revision.status == "candidate"
        ):
            raise HTTPException(404, "Saved revision not found")
        prior = await CurriculumRepository(self.session, owner_id).read_revision(
            view.roadmap_id, revision_id
        )
        return await self._save(
            view, owner_id, prior.candidate, prior.sources, base_revision_id, history_removal_ack
        )

    async def history(self, workspace_id: str, owner_id: str) -> list[RevisionSummary]:
        view = await self._view(workspace_id, owner_id, write=False)
        rows = (
            await self.session.scalars(
                select(CurriculumRevision)
                .where(CurriculumRevision.roadmap_id == view.roadmap_id)
                .order_by(CurriculumRevision.created_at.desc(), CurriculumRevision.id.desc())
            )
        ).all()
        result = []
        repo = CurriculumRepository(self.session, owner_id)
        for row in rows:
            current = await repo.read_revision(view.roadmap_id, row.id)
            before = (
                await repo.read_revision(view.roadmap_id, row.base_revision_id)
                if row.base_revision_id
                else None
            )
            old = {i.id: i for i in before.candidate.items} if before else {}
            new = {i.id: i for i in current.candidate.items}
            changed = {key for key in old.keys() & new.keys() if old[key] != new[key]}
            changed.update(
                {
                    r.target_id
                    for r in current.candidate.relations
                    if before and r not in before.candidate.relations
                }
            )
            if before:
                for key in old.keys() & new.keys():
                    if (
                        [r for r in before.candidate.resources if r.topic_id == key]
                        != [r for r in current.candidate.resources if r.topic_id == key]
                        or [s for s in before.candidate.sessions if s.topic_id == key]
                        != [s for s in current.candidate.sessions if s.topic_id == key]
                        or [c for c in before.candidate.choices if c.choice_id == key]
                        != [c for c in current.candidate.choices if c.choice_id == key]
                    ):
                        changed.add(key)
            removed = old.keys() - new.keys()
            result.append(
                RevisionSummary(
                    id=row.id,
                    base_revision_id=row.base_revision_id,
                    status=row.status,
                    title=row.title,
                    created_at=row.created_at,
                    added=sorted(new.keys() - old.keys()),
                    changed=sorted(changed),
                    removed=sorted(removed),
                    has_learning_history=await self._has_history(view.roadmap_id, set(removed)),
                )
            )
        return result

    async def archived_topics(self, workspace_id: str, owner_id: str) -> list[ArchivedTopic]:
        view = await self._view(workspace_id, owner_id, write=False)
        active = {i.id for i in view.candidate.items if i.participation == "active"}
        history = await self.history(workspace_id, owner_id)
        found = {}
        repo = CurriculumRepository(self.session, owner_id)
        for revision in history:
            if revision.status == "candidate":
                continue
            prior = await repo.read_revision(view.roadmap_id, revision.id)
            for item in prior.candidate.items:
                if item.kind == "topic" and item.id not in active and item.id not in found:
                    rows = (
                        await self.session.scalars(
                            select(TopicChat)
                            .where(
                                TopicChat.roadmap_id == view.roadmap_id,
                                TopicChat.topic_id == item.id,
                                TopicChat.owner_id == owner_id,
                            )
                            .order_by(TopicChat.created_at.desc())
                        )
                    ).all()
                    found[item.id] = ArchivedTopic(
                        item=item,
                        progress=prior.progress.get(item.id, TopicProgressData(topic_id=item.id)),
                        sessions=[
                            await TutorService(self.session).session_data(row.id, owner_id)
                            for row in rows
                        ],
                    )
        return list(found.values())

    async def associate_source(
        self, workspace_id: str, owner_id: str, source: SourceData
    ) -> SourceData:
        view = await self._view(workspace_id, owner_id)
        await self.session.scalar(
            select(Roadmap).where(Roadmap.id == view.roadmap_id).with_for_update()
        )
        existing = await self.session.scalar(
            select(ResearchSource).where(
                ResearchSource.roadmap_id == view.roadmap_id, ResearchSource.url == source.url
            )
        )
        if existing is not None:
            return SourceData.model_validate(existing.payload)
        count = await self.session.scalar(
            select(func.count())
            .select_from(ResearchSource)
            .where(ResearchSource.roadmap_id == view.roadmap_id)
        )
        if (count or 0) >= 600:
            raise RevisionValidationError(message="This roadmap has reached its source limit")
        # Inspection is server-created and stored independently of revision membership.
        self.session.add(
            ResearchSource(
                id=source.id,
                roadmap_id=view.roadmap_id,
                owner_id=owner_id,
                url=source.url,
                reference_id=source.reference_id,
                payload=source.model_dump(mode="json"),
            )
        )
        await self.session.flush()
        return source
