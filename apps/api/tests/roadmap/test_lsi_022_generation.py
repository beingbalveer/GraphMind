"""LSI-022: owned job creation, server-driven status, and result resolution.

These focus on the acceptance contract for the Learning Studio generation flow:
- a duplicate submission resolves to exactly one owned job;
- progress phases come from persisted server events, not a client timer;
- a completed generation resolves the actual workspace, revision, protected
  canvas anchor, and saved profile.

They reuse the existing durable job repository, worker, and publication service;
no production code is changed. Tests require the isolated ``_test`` database
enforced by ``apps/api/tests/conftest.py``.
"""

import uuid

import pytest
from database import get_session_factory
from models.roadmap_job import RoadmapJob
from models.user import User
from models.workspace import NodeModel, Workspace
from schemas.curriculum import Duration, RoadmapRequest
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.job_repository import JobStateError
from sqlalchemy import delete, func, select


async def test_duplicate_submission_resolves_to_one_owned_job(job_repo, job_owner, curriculum_session):
    request = RoadmapRequest(prompt="Learn practical beginner drawing", level="beginner")
    key = str(uuid.uuid4())

    first = await job_repo.create(job_owner, request, key)
    duplicate = await job_repo.create(job_owner, request, key)

    assert duplicate.id == first.id
    assert (
        await curriculum_session.scalar(
            select(func.count())
            .select_from(RoadmapJob)
            .where(RoadmapJob.owner_id == job_owner)
        )
        == 1
    )

    # A different body under the same key is rejected, never silently accepted.
    with pytest.raises(JobStateError) as error:
        await job_repo.create(
            job_owner, RoadmapRequest(prompt="Learn piano technique"), key
        )
    assert error.value.code == "IDEMPOTENCY_MISMATCH"


async def test_deterministic_generation_resolves_workspace_revision_anchor_and_profile(
    job_repo,
    job_owner,
    worker,
    curriculum_session,
    scripted_executor,
    small_profile,
):
    request = RoadmapRequest(
        title="Backend Foundations",
        prompt="Learn asynchronous backend engineering with FastAPI",
        level="intermediate",
        outcome="Ship one tested async endpoint",
        known_skills=["Python", "HTTP"],
        reference_url="https://example.com/syllabus",
        duration=Duration(value=6, unit="weeks"),
        hours_per_week=6,
    )
    key = str(uuid.uuid4())
    created = await job_repo.create(job_owner, request, key)
    duplicate = await job_repo.create(job_owner, request, key)
    assert duplicate.id == created.id
    await job_repo.start(created.id, job_owner)
    await curriculum_session.commit()

    try:
        for _ in range(10):
            if not await worker.run_once("lsi-022-worker"):
                break

        job = await job_repo.read(created.id, job_owner)
        assert job.status == "completed"
        assert job.result is not None and job.result.kind == "published"
        # The submitted request (including the LSI-020 extensions) is retained.
        assert job.request.outcome == "Ship one tested async endpoint"
        assert job.request.known_skills == ["Python", "HTTP"]
        assert job.request.reference_url == "https://example.com/syllabus"

        # Progress phases are persisted server events in strict sequence order.
        events = await job_repo.events(created.id, job_owner, 0)
        sequences = [event.sequence for event in events]
        assert sequences == sorted(sequences)
        assert len(set(sequences)) == len(sequences)
        assert {"started", "completed"}.issubset({event.type for event in events})

        # Completion resolves the actual workspace, revision, anchor, and profile.
        view = await CurriculumRepository(curriculum_session).read(
            job.result.workspace_id
        )
        assert view is not None
        assert view.revision_id == job.result.revision_id
        assert view.roadmap_id == job.result.roadmap_id

        anchor = await curriculum_session.get(
            NodeModel, view.canvas_anchor_chat_id, populate_existing=True
        )
        assert anchor is not None
        assert anchor.workspace_id == view.workspace_id
        assert anchor.parent_id is None
        assert anchor.metadata_payload["kind"] == "roadmap_anchor"
        assert anchor.metadata_payload["roadmapId"] == job.result.roadmap_id

        assert view.profile == small_profile

        # The owner sees exactly one produced workspace.
        async with get_session_factory()() as session:
            assert (
                await session.scalar(
                    select(func.count())
                    .select_from(Workspace)
                    .where(Workspace.owner_id == job_owner)
                )
                == 1
            )
    finally:
        await curriculum_session.rollback()
        await curriculum_session.execute(
            delete(Workspace).where(Workspace.owner_id == job_owner)
        )
        await curriculum_session.execute(
            delete(RoadmapJob).where(RoadmapJob.owner_id == job_owner)
        )
        await curriculum_session.execute(delete(User).where(User.id == job_owner))
        await curriculum_session.commit()
