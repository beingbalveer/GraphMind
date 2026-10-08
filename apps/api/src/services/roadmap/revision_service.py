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
from models.roadmap_job import RoadmapJob
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
from schemas.roadmap_edit import (
    ArchivedTopic,
    EditRequest,
    RevisionDiff,
    RevisionProposalData,
    RevisionSummary,
)
from schemas.roadmap_job import JobCheckpoint, JobSnapshot
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
        roadmap = await self.session.scalar(
            select(Roadmap)
            .where(Roadmap.id == view.roadmap_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        revision = await self.session.get(CurriculumRevision, revision_id, populate_existing=True)
        if roadmap is None or revision is None or revision.roadmap_id != view.roadmap_id:
            raise HTTPException(404, "Proposal not found")
        if roadmap.current_revision_id == revision_id:
            result = await CurriculumRepository(self.session, owner_id).read(workspace_id)
            assert result is not None
            return result
        if revision.status == "archived":
            # An applied proposal is subsequently archived by a newer change.
            # Retrying that successful request never overwrites the newer plan.
            result = await CurriculumRepository(self.session, owner_id).read(workspace_id)
            assert result is not None
            return result
        if revision.status != "candidate":
            raise HTTPException(404, "Proposal not found")
        if (
            revision.base_revision_id != base_revision_id
            or roadmap.current_revision_id != base_revision_id
        ):
            raise RevisionConflictError(
                "This proposal is based on an older revision; reload and regenerate"
            )
        proposed = await CurriculumRepository(self.session, owner_id).read_revision(
            view.roadmap_id, revision_id
        )
        report = validate_curriculum(proposed.candidate, view.profile, proposed.sources)
        if not report.valid:
            raise RevisionValidationError(report)
        removed = {i.id for i in view.candidate.items if i.participation == "active"} - {
            i.id for i in proposed.candidate.items if i.participation == "active"
        }
        if not history_removal_ack and await self._has_history(view.roadmap_id, removed):
            raise HistoryRemovalRequiredError(
                "These changes archive topics with saved learning history"
            )
        await ProgressService(self.session).authorize(workspace_id, owner_id)
        previous = await self.session.get(CurriculumRevision, base_revision_id)
        assert previous is not None
        previous.status = "archived"
        revision.status = "active"
        roadmap.current_revision_id = revision.id
        proposal_job = await self.session.scalar(
            select(RoadmapJob).where(
                RoadmapJob.operation == "refine",
                RoadmapJob.result["revision_id"].as_string() == revision.id,
            )
        )
        if proposal_job is not None and proposal_job.result is not None:
            from services.roadmap.publication import PublicationService

            await PublicationService(self.session)._associate_references(
                proposal_job.id, workspace_id
            )
            proposal_job.result = {**proposal_job.result, "proposal_state": "applied"}
        await self.session.flush()
        result = await CurriculumRepository(self.session, owner_id).read(workspace_id)
        assert result is not None
        logger.info("curriculum_proposal_applied", roadmap_id=roadmap.id, revision_id=revision.id)
        return result

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

    async def request_refinement(
        self, workspace_id: str, owner_id: str, instruction: str, base_revision_id: str, key: str
    ) -> JobSnapshot:
        from schemas.curriculum import RoadmapRequest
        from services.roadmap.job_repository import JobRepository

        view = await self._view(workspace_id, owner_id)
        try:
            base = await CurriculumRepository(self.session, owner_id).read_revision(
                view.roadmap_id, base_revision_id
            )
        except ValueError:
            raise HTTPException(404, "Base revision not found") from None
        request = RoadmapRequest(
            title=base.candidate.title,
            prompt=instruction,
            level=base.profile.level,
            background=base.profile.background,
            duration=base.profile.duration,
            hours_per_week=base.profile.hours_per_week,
        )
        jobs = JobRepository(self.session)
        job = await jobs.create(
            owner_id, request, key, operation="refine", base_revision_id=base_revision_id
        )
        if job.startup_ready:
            return job
        if view.revision_id != base_revision_id:
            raise RevisionConflictError("Roadmap changed; reload before requesting refinement")
        row = await self.session.get(RoadmapJob, job.id)
        assert row is not None
        row.checkpoint = JobCheckpoint(
            workspace_id=workspace_id,
            profile=base.profile,
            candidate=base.candidate,
            original_candidate=base.candidate,
            sources=base.sources,
            study_progress=base.progress,
        ).model_dump(mode="json")
        await self.session.flush()
        return await jobs.start(job.id, owner_id)

    async def proposal(
        self, workspace_id: str, owner_id: str, revision_id: str
    ) -> RevisionProposalData:
        from schemas.roadmap_edit import RevisionProposalData

        current = await self._view(workspace_id, owner_id, write=False)
        row = await self.session.get(CurriculumRevision, revision_id)
        if row is None or row.roadmap_id != current.roadmap_id or row.base_revision_id is None:
            raise HTTPException(404, "Proposal not found")
        proposed = await CurriculumRepository(self.session, owner_id).read_revision(
            current.roadmap_id, revision_id
        )
        original = await CurriculumRepository(self.session, owner_id).read_revision(
            current.roadmap_id, row.base_revision_id
        )
        diff = compare_revisions(original.candidate, proposed.candidate)
        completed = [
            key
            for key in diff.changed + diff.removed
            if current.progress.get(key) and current.progress[key].status == "completed"
        ]
        own_job = await self.session.scalar(
            select(RoadmapJob).where(
                RoadmapJob.owner_id == owner_id,
                RoadmapJob.operation == "refine",
                RoadmapJob.result["revision_id"].as_string() == revision_id,
            )
        )
        instruction = str(own_job.request["prompt"]) if own_job is not None else None
        return RevisionProposalData(
            instruction=instruction,
            original=original.candidate,
            view=proposed,
            base_revision_id=row.base_revision_id,
            diff=diff,
            affected_completed_topics=completed,
            status=row.status,
            outdated=row.status == "candidate" and current.revision_id != row.base_revision_id,
        )

    async def reject_proposal(self, workspace_id: str, owner_id: str, revision_id: str) -> None:
        view = await self._view(workspace_id, owner_id)
        roadmap = await self.session.scalar(
            select(Roadmap).where(Roadmap.id == view.roadmap_id).with_for_update()
        )
        row = await self.session.get(CurriculumRevision, revision_id, populate_existing=True)
        if roadmap is None or row is None or row.roadmap_id != view.roadmap_id:
            raise HTTPException(404, "Proposal not found")
        if row.status == "candidate":
            row.status = "rejected"
            proposal_job = await self.session.scalar(
                select(RoadmapJob).where(
                    RoadmapJob.operation == "refine",
                    RoadmapJob.result["revision_id"].as_string() == revision_id,
                )
            )
            if proposal_job is not None and proposal_job.result is not None:
                proposal_job.result = {**proposal_job.result, "proposal_state": "rejected"}
            await self.session.flush()


def compare_revisions(before: CurriculumCandidate, after: CurriculumCandidate) -> RevisionDiff:

    old = {i.id: i for i in before.items if i.participation == "active"}
    new = {i.id: i for i in after.items if i.participation == "active"}
    changed = {key for key in old.keys() & new.keys() if old[key] != new[key]}
    for key in old.keys() & new.keys():
        if any(
            [r for r in getattr(before, field) if getattr(r, identity) == key]
            != [r for r in getattr(after, field) if getattr(r, identity) == key]
            for field, identity in (
                ("resources", "topic_id"),
                ("sessions", "topic_id"),
                ("choices", "choice_id"),
            )
        ):
            changed.add(key)
        if [r for r in before.relations if r.target_id == key] != [
            r for r in after.relations if r.target_id == key
        ]:
            changed.add(key)
    added = sorted(new.keys() - old.keys())
    removed = sorted(old.keys() - new.keys())
    return RevisionDiff(
        added=added,
        removed=removed,
        changed=sorted(changed),
        summary=f"{len(added)} added, {len(changed)} changed, {len(removed)} removed",
    )


def identity_review_issues(
    before: CurriculumCandidate, after: CurriculumCandidate, continuity: dict[str, str]
) -> list[str]:
    original = {i.id: i for i in before.items if i.kind == "topic"}
    issues = []
    for item in after.items:
        old = original.get(item.id)
        if old is None or item.kind != "topic" or item.participation != "active":
            continue
        fields = ("title", "brief", "objectives", "exercise", "format")
        if (
            any(getattr(old, field) != getattr(item, field) for field in fields)
            and len(continuity.get(item.id, "").strip()) < 20
        ):
            issues.append(
                f"Verify concept continuity for reused topic {item.id}; otherwise use a new ID and archive the previous concept."
            )
    return issues
