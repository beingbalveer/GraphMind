import re
import uuid
from collections.abc import Callable
from datetime import datetime

from models.roadmap import CurriculumRevision, ResearchSource, Roadmap, new_id
from models.roadmap_job import RoadmapJobReference
from models.user import WorkspaceMember
from models.workspace import NodeModel, Workspace, WorkspaceFile, WorkspaceFileChunk
from schemas.curriculum import CurriculumCandidate, LearningProfile, SourceData
from schemas.roadmap_job import Claim, JobCheckpoint, JobResult, ReferenceSection
from schemas.workspace import WorkspaceCreate
from services.chunking_service import ChunkingService
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.validation import validate_curriculum
from services.workspace_service import WorkspaceService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def generation_identities(
    job_id: str, candidate: CurriculumCandidate, sources: list[SourceData]
) -> tuple[CurriculumCandidate, list[SourceData]]:
    """Agent-local labels become globally stable IDs, deterministically scoped to this job."""

    def identity(kind: str, value: str) -> str:
        return f"{kind}_{uuid.uuid5(uuid.NAMESPACE_URL, f'graphmind:{job_id}:{kind}:{value}').hex}"

    items = {item.id: identity("item", item.id) for item in candidate.items}
    source_ids = {source.id: identity("src", source.id) for source in sources}

    def item_id(value: str) -> str:
        return items.get(value, value)

    materialized = candidate.model_copy(
        update={
            "items": [item.model_copy(update={"id": item_id(item.id)}) for item in candidate.items],
            "relations": [
                relation.model_copy(
                    update={
                        "source_id": item_id(relation.source_id),
                        "target_id": item_id(relation.target_id),
                    }
                )
                for relation in candidate.relations
            ],
            "choices": [
                choice.model_copy(
                    update={
                        "choice_id": item_id(choice.choice_id),
                        "selected_id": item_id(choice.selected_id),
                    }
                )
                for choice in candidate.choices
            ],
            "sessions": [
                session.model_copy(update={"topic_id": item_id(session.topic_id)})
                for session in candidate.sessions
            ],
            "resources": [
                resource.model_copy(
                    update={
                        "topic_id": item_id(resource.topic_id),
                        "source_id": source_ids.get(resource.source_id, resource.source_id),
                    }
                )
                for resource in candidate.resources
            ],
        }
    )
    return materialized, [
        source.model_copy(update={"id": source_ids[source.id]}) for source in sources
    ]


def refinement_identities(
    job_id: str, original: CurriculumCandidate, candidate: CurriculumCandidate
) -> CurriculumCandidate:
    existing = {item.id for item in original.items}
    identities = {
        item.id: item.id
        if item.id in existing
        else f"item_{uuid.uuid5(uuid.NAMESPACE_URL, f'graphmind:refine:{job_id}:{item.id}').hex}"
        for item in candidate.items
    }

    def mapped(value: str) -> str:
        return identities.get(value, value)

    return candidate.model_copy(
        update={
            "items": [item.model_copy(update={"id": mapped(item.id)}) for item in candidate.items],
            "relations": [
                relation.model_copy(
                    update={
                        "source_id": mapped(relation.source_id),
                        "target_id": mapped(relation.target_id),
                    }
                )
                for relation in candidate.relations
            ],
            "choices": [
                choice.model_copy(
                    update={
                        "choice_id": mapped(choice.choice_id),
                        "selected_id": mapped(choice.selected_id),
                    }
                )
                for choice in candidate.choices
            ],
            "sessions": [
                session.model_copy(update={"topic_id": mapped(session.topic_id)})
                for session in candidate.sessions
            ],
            "resources": [
                resource.model_copy(update={"topic_id": mapped(resource.topic_id)})
                for resource in candidate.resources
            ],
        }
    )


class PublicationService:
    """Owns no commit; result and all workspace rows share the caller's transaction."""

    def __init__(
        self, session: AsyncSession, *, clock: Callable[[], datetime] | None = None
    ) -> None:
        self.session = session
        self.jobs = JobRepository(session, clock=clock)

    async def publish(self, claim: Claim) -> JobResult:
        job = await self.jobs._row(claim.job_id)
        if job.result is not None and job.status == "completed":
            return JobResult.model_validate(job.result)
        job, _ = await self.jobs._claimed(claim)
        self.jobs._execution_budget(job)
        checkpoint = JobCheckpoint.model_validate(job.checkpoint)
        if (
            claim.stage != "publish"
            or checkpoint.validation is None
            or not checkpoint.validation.valid
            or checkpoint.profile is None
            or checkpoint.candidate is None
            or checkpoint.completed_stages
            != ["understand", "research", "compose", "personalize", "validate"]
        ):
            raise ValueError("UNVALIDATED_PUBLICATION")
        profile = checkpoint.profile
        candidate = checkpoint.candidate
        sources = checkpoint.sources
        repository = CurriculumRepository(self.session, reader_id=job.owner_id)
        old_sources: set[str] = set()
        if job.operation == "refine":
            base = await self.session.get(CurriculumRevision, job.base_revision_id)
            if base is None:
                raise JobStateError(
                    "REVISION_NOT_FOUND", "The roadmap being refined is no longer available"
                )
            roadmap = await self.session.get(Roadmap, base.roadmap_id)
            if roadmap is None:
                raise JobStateError("ROADMAP_NOT_FOUND")
            existing_workspace = await self.session.scalar(
                select(Workspace).where(Workspace.id == roadmap.workspace_id).with_for_update()
            )
            member = await self.session.scalar(
                select(WorkspaceMember)
                .where(
                    WorkspaceMember.workspace_id == roadmap.workspace_id,
                    WorkspaceMember.user_id == job.owner_id,
                )
                .with_for_update()
            )
            if existing_workspace is None or (
                existing_workspace.owner_id != job.owner_id
                and (member is None or member.role not in {"owner", "editor"})
            ):
                raise JobStateError(
                    "WORKSPACE_FORBIDDEN", "You no longer have permission to refine this roadmap"
                )
            from services.roadmap.revision_service import identity_review_issues

            original = await repository.read_revision(roadmap.id, base.id)
            if checkpoint.original_candidate != original.candidate or identity_review_issues(
                original.candidate, candidate, checkpoint.identity_continuity
            ):
                raise JobStateError(
                    "IDENTITY_REVIEW_REQUIRED",
                    "Verify learning concept identities before publishing this proposal",
                )
            profile = LearningProfile.model_validate(roadmap.profile)
            old_sources = set(
                (
                    await self.session.scalars(
                        select(ResearchSource.id).where(ResearchSource.roadmap_id == roadmap.id)
                    )
                ).all()
            )
            actual = validate_curriculum(candidate, profile, sources)
            if not actual.valid or actual != checkpoint.validation:
                raise ValueError("UNVALIDATED_PUBLICATION")
            candidate = refinement_identities(job.id, original.candidate, candidate)
            actual = validate_curriculum(candidate, profile, sources)
            if not actual.valid:
                raise ValueError("UNVALIDATED_PUBLICATION")
            checkpoint.candidate = candidate
            checkpoint.validation = actual
            revision_id = await repository.save_revision(
                roadmap.id, base.id, candidate, sources, actual, "candidate"
            )
            result = JobResult(
                workspace_id=roadmap.workspace_id,
                roadmap_id=roadmap.id,
                revision_id=revision_id,
                kind="proposal",
                proposal_state="candidate",
            )
        else:
            actual = validate_curriculum(candidate, profile, sources)
            if not actual.valid or actual != checkpoint.validation:
                raise ValueError("UNVALIDATED_PUBLICATION")
            candidate, sources = generation_identities(job.id, candidate, sources)
            actual = validate_curriculum(candidate, profile, sources)
            if not actual.valid:
                raise ValueError("UNVALIDATED_PUBLICATION")
            checkpoint.candidate = candidate
            checkpoint.sources = sources
            checkpoint.validation = actual
            workspace = await WorkspaceService.create_workspace(
                self.session,
                WorkspaceCreate(name=candidate.title, description=candidate.outcome),
                owner_id=job.owner_id,
            )
            # The anchor is a structural record; it never invokes a provider while publishing.
            anchor = NodeModel(
                id=new_id("node"),
                workspace_id=workspace.id,
                role="system",
                content=candidate.title,
                metadata_payload={
                    "kind": "roadmap_anchor",
                    "title": candidate.title,
                    "originJobId": job.id,
                },
            )
            self.session.add(anchor)
            await self.session.flush()
            view = await repository.create(
                job.owner_id, workspace.id, anchor.id, profile, candidate, sources, actual
            )
            roadmap = await self.session.get(Roadmap, view.roadmap_id)
            assert roadmap is not None
            roadmap.origin_job_id = job.id
            anchor.metadata_payload = {**anchor.metadata_payload, "roadmapId": view.roadmap_id}
            await self._associate_references(job.id, workspace.id)
            result = JobResult(
                workspace_id=workspace.id,
                roadmap_id=view.roadmap_id,
                revision_id=view.revision_id,
                kind="published",
            )
        for source in sources:
            if source.id not in old_sources:
                row = await self.session.get(ResearchSource, source.id)
                assert row is not None
                row.origin_job_id = job.id
        await self.session.flush()
        # Recheck elapsed time/lease after bounded local work, before recording completion.
        now = await self.jobs._now()
        if job.lease_until is None or job.lease_until <= now:
            from services.roadmap.job_repository import StaleLeaseError

            raise StaleLeaseError()
        self.jobs._account(job, now)
        self.jobs._execution_budget(job)
        checkpoint.completed_stages.append("publish")
        job.checkpoint = checkpoint.model_dump(mode="json")
        job.result = result.model_dump(mode="json")
        job.status = "completed"
        self.jobs._release(job)
        await self.jobs._event(
            job,
            "completed",
            "Your roadmap is ready"
            if result.kind == "published"
            else "Your refinement is ready to review",
            {"workspaceId": result.workspace_id, "revisionId": result.revision_id},
        )
        await self.session.flush()
        return result

    async def _associate_references(self, job_id: str, workspace_id: str) -> None:
        references = (
            await self.session.scalars(
                select(RoadmapJobReference)
                .where(RoadmapJobReference.job_id == job_id)
                .with_for_update()
            )
        ).all()
        chunker = ChunkingService()
        for reference in references:
            if reference.workspace_id is not None and reference.workspace_id != workspace_id:
                raise JobStateError("REFERENCE_OWNERSHIP_MISMATCH")
            reference.workspace_id = workspace_id
            if reference.kind != "file" or reference.storage_path is None:
                continue
            sections = [ReferenceSection.model_validate(section) for section in reference.sections]
            text = "\n\n".join(f"[{section.locator}]\n{section.text}" for section in sections)
            file = WorkspaceFile(
                id=new_id("file"),
                workspace_id=workspace_id,
                name=reference.name,
                size_bytes=reference.size_bytes,
                mime_type=reference.content_type or "text/plain",
                file_category="document",
                storage_path=reference.storage_path,
                extracted_text=text or None,
                metadata_payload={
                    "referenceId": reference.id,
                    "originJobId": job_id,
                    "status": reference.status,
                    "extractionNote": reference.error,
                },
            )
            self.session.add(file)
            await self.session.flush()
            index = 0
            for section in sections:
                page_match = re.match(r"Page (\d+)", section.locator)
                for chunk in chunker.chunk_document(
                    reference.name, section.text, file_category="document"
                ):
                    self.session.add(
                        WorkspaceFileChunk(
                            id=new_id("chunk"),
                            workspace_id=workspace_id,
                            file_id=file.id,
                            chunk_index=index,
                            content=chunk.content,
                            enriched_content=f"[Document: {reference.name} | {section.locator}]\n\n{chunk.content}",
                            page_number=int(page_match.group(1)) if page_match else None,
                            section_header=section.locator[:255],
                            token_count=chunk.token_count,
                            metadata_payload={
                                "referenceId": reference.id,
                                "locator": section.locator,
                            },
                            embedding=None,
                        )
                    )
                    index += 1
        await self.session.flush()
