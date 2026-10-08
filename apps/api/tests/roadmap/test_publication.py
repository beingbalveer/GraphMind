import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from database import get_session_factory
from models.roadmap import CurriculumRevision, Roadmap
from models.roadmap_job import RoadmapJob, RoadmapJobEvent, RoadmapJobReference
from models.user import WorkspaceMember
from models.workspace import NodeModel, Workspace, WorkspaceFile, WorkspaceFileChunk
from schemas.curriculum import RoadmapRequest
from services.roadmap.job_repository import StaleLeaseError
from services.roadmap.publication import PublicationService
from sqlalchemy import func, select


async def test_unvalidated_job_cannot_publish(job_repo, ready_job, clock, publication):
    claim = await job_repo.claim("worker", clock.now())
    with pytest.raises(ValueError, match="UNVALIDATED_PUBLICATION"):
        await publication.publish(claim)
    assert (await job_repo.read(ready_job.id, ready_job.owner_id)).result is None


async def test_publish_is_atomic_idempotent_and_creates_owner_membership(
    publication, publish_claim, ready_job, curriculum_session, job_repo, monkeypatch
):
    from services.semantic_service import SemanticService

    no_network = AsyncMock(side_effect=AssertionError("Publication must not call embeddings"))
    monkeypatch.setattr(SemanticService, "compute_and_save_node_embedding", no_network)
    first = await publication.publish(publish_claim)
    assert await publication.publish(publish_claim) == first
    assert first.kind == "published"
    job = await job_repo.read(ready_job.id, ready_job.owner_id)
    assert job.status == "completed" and job.result == first
    ws = await curriculum_session.get(Workspace, first.workspace_id)
    assert ws.owner_id == ready_job.owner_id
    membership = await curriculum_session.scalar(
        select(WorkspaceMember).where(WorkspaceMember.workspace_id == ws.id)
    )
    assert membership.user_id == ready_job.owner_id and membership.role == "owner"
    roadmap = await curriculum_session.get(Roadmap, first.roadmap_id)
    assert roadmap.origin_job_id == ready_job.id
    anchor = await curriculum_session.get(NodeModel, roadmap.canvas_anchor_chat_id)
    assert anchor.parent_id is None and anchor.metadata_payload["kind"] == "roadmap_anchor"
    completed = [
        event
        for event in await job_repo.events(ready_job.id, ready_job.owner_id, 0)
        if event.type == "completed"
    ]
    assert len(completed) == 1
    no_network.assert_not_awaited()


async def test_cancel_and_stale_lease_prevent_publication(
    publication, publish_claim, ready_job, job_repo, clock, curriculum_session
):
    with pytest.raises(StaleLeaseError):
        await publication.publish(
            publish_claim.model_copy(update={"fence": publish_claim.fence - 1})
        )
    await job_repo.cancel(ready_job.id, ready_job.owner_id)
    with pytest.raises(StaleLeaseError):
        await publication.publish(publish_claim)
    assert (
        await curriculum_session.scalar(
            select(func.count())
            .select_from(Workspace)
            .where(Workspace.owner_id == ready_job.owner_id)
        )
        == 0
    )


async def test_mid_publication_rollback_preserves_job_and_staged_input(
    publication, publish_claim, ready_job, curriculum_session, job_repo, monkeypatch
):
    from services.roadmap.curriculum_repository import CurriculumRepository

    await curriculum_session.commit()
    original = CurriculumRepository.create

    async def create_then_fail(*args, **kwargs):
        await original(*args, **kwargs)
        raise RuntimeError("Injected database failure")

    monkeypatch.setattr(CurriculumRepository, "create", create_then_fail)
    try:
        with pytest.raises(RuntimeError, match="Injected database failure"):
            await publication.publish(publish_claim)
        await curriculum_session.rollback()
        assert (
            await curriculum_session.scalar(
                select(func.count())
                .select_from(Workspace)
                .where(Workspace.owner_id == ready_job.owner_id)
            )
            == 0
        )
        job = await job_repo.read(ready_job.id, ready_job.owner_id)
        assert job.status == "running" and job.result is None and job.checkpoint.validation.valid
    finally:
        from sqlalchemy import delete

        await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.id == ready_job.id))
        await curriculum_session.commit()


async def test_staged_file_is_associated_without_move_or_embedding(
    publication, publish_claim, ready_job, curriculum_session, tmp_path
):
    reference = RoadmapJobReference(
        id="ref_test",
        job_id=ready_job.id,
        kind="file",
        name="notes.txt",
        dedup_key=uuid.uuid4().hex,
        status="inspected",
        size_bytes=12,
        content_type="text/plain",
        storage_path=str(tmp_path / "original.bin"),
        sections=[
            {
                "reference_id": "ref_test",
                "locator": "Page 2",
                "text": "Practice perspective with a sketch.",
            }
        ],
    )
    (tmp_path / "original.bin").write_bytes(b"Original data")
    curriculum_session.add(reference)
    await curriculum_session.flush()
    result = await publication.publish(publish_claim)
    file = await curriculum_session.scalar(
        select(WorkspaceFile).where(WorkspaceFile.workspace_id == result.workspace_id)
    )
    assert (
        file.storage_path == str(tmp_path / "original.bin") and (tmp_path / "original.bin").exists()
    )
    assert (
        reference.workspace_id == result.workspace_id
        and file.metadata_payload["referenceId"] == reference.id
    )
    chunks = (
        await curriculum_session.scalars(
            select(WorkspaceFileChunk).where(WorkspaceFileChunk.file_id == file.id)
        )
    ).all()
    assert (
        chunks and chunks[0].page_number == 2 and all(chunk.embedding is None for chunk in chunks)
    )


async def test_refinement_publishes_proposal_without_replacing_current(
    publication,
    curriculum_workspace,
    job_repo,
    job_owner,
    clock,
    scripted_executor,
    curriculum_session,
):
    view = curriculum_workspace.view
    job = await job_repo.create(
        job_owner,
        RoadmapRequest(prompt="Add a practical project option"),
        str(uuid.uuid4()),
        operation="refine",
        base_revision_id=view.revision_id,
    )
    # Editor authorization must be verified again at publication, not only when enqueued.
    curriculum_session.add(
        WorkspaceMember(workspace_id=view.workspace_id, user_id=job_owner, role="editor")
    )
    await curriculum_session.flush()
    await job_repo.start(job.id, job_owner)
    for result in scripted_executor.results.values():
        result.checkpoint.original_candidate = view.candidate
    for stage in ["understand", "research", "compose", "personalize", "validate"]:
        claim = await job_repo.claim("worker", clock.now())
        await job_repo.checkpoint(claim, stage, scripted_executor.results[stage])
    claim = await job_repo.claim("worker", clock.now())
    result = await publication.publish(claim)
    assert result.kind == "proposal" and result.workspace_id == view.workspace_id
    current = await curriculum_session.get(Roadmap, view.roadmap_id)
    assert current.current_revision_id == view.revision_id
    revision = await curriculum_session.get(CurriculumRevision, result.revision_id)
    assert revision.status == "candidate" and revision.base_revision_id == view.revision_id


async def test_two_publishers_commit_one_workspace(
    publication, publish_claim, ready_job, curriculum_session, clock
):
    await curriculum_session.commit()

    async def publish():
        async with get_session_factory()() as session:
            result = await PublicationService(session, clock=clock.now).publish(publish_claim)
            await session.commit()
            return result

    try:
        first, second = await asyncio.gather(publish(), publish())
        assert first == second
        assert (
            await curriculum_session.scalar(
                select(func.count())
                .select_from(Workspace)
                .where(Workspace.owner_id == ready_job.owner_id)
            )
            == 1
        )
        assert (
            await curriculum_session.scalar(
                select(func.count())
                .select_from(RoadmapJobEvent)
                .where(RoadmapJobEvent.job_id == ready_job.id, RoadmapJobEvent.type == "completed")
            )
            == 1
        )
    finally:
        from sqlalchemy import delete

        await curriculum_session.execute(
            delete(Workspace).where(Workspace.owner_id == ready_job.owner_id)
        )
        await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.id == ready_job.id))
        await curriculum_session.commit()


async def test_revoked_editor_cannot_publish_refinement(
    publication,
    curriculum_workspace,
    job_repo,
    job_owner,
    clock,
    scripted_executor,
    curriculum_session,
):
    view = curriculum_workspace.view
    job = await job_repo.create(
        job_owner,
        RoadmapRequest(prompt="Add a practice project"),
        str(uuid.uuid4()),
        operation="refine",
        base_revision_id=view.revision_id,
    )
    await job_repo.start(job.id, job_owner)
    for stage in ["understand", "research", "compose", "personalize", "validate"]:
        claim = await job_repo.claim("worker", clock.now())
        await job_repo.checkpoint(claim, stage, scripted_executor.results[stage])
    claim = await job_repo.claim("worker", clock.now())
    from services.roadmap.job_repository import JobStateError

    with pytest.raises(JobStateError) as error:
        await publication.publish(claim)
    assert error.value.code == "WORKSPACE_FORBIDDEN"
    assert (
        await curriculum_session.get(Roadmap, view.roadmap_id)
    ).current_revision_id == view.revision_id


async def test_two_generated_curricula_keep_independent_stable_identities(
    publication, publish_claim, ready_job, job_repo, clock, scripted_executor, curriculum_session
):
    from services.roadmap.curriculum_repository import CurriculumRepository

    first = await publication.publish(publish_claim)
    second_job = await job_repo.create(
        ready_job.owner_id,
        RoadmapRequest(prompt="Learn another drawing approach"),
        str(uuid.uuid4()),
    )
    await job_repo.start(second_job.id, ready_job.owner_id)
    for stage in ["understand", "research", "compose", "personalize", "validate"]:
        claim = await job_repo.claim("worker", clock.now())
        await job_repo.checkpoint(claim, stage, scripted_executor.results[stage])
    second = await publication.publish(await job_repo.claim("worker", clock.now()))
    repository = CurriculumRepository(curriculum_session)
    first_view = await repository.read(first.workspace_id)
    second_view = await repository.read(second.workspace_id)
    first_ids = {item.id for item in first_view.candidate.items}
    second_ids = {item.id for item in second_view.candidate.items}
    assert first_ids.isdisjoint(second_ids)
    assert {source.id for source in first_view.sources}.isdisjoint(
        source.id for source in second_view.sources
    )
    assert all(resource.topic_id in second_ids for resource in second_view.candidate.resources)
    assert [item.title for item in first_view.candidate.items] == [
        item.title for item in second_view.candidate.items
    ]
