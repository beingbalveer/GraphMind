import asyncio
import uuid

import pytest
from database import get_session_factory
from models.roadmap_job import RoadmapJob
from schemas.curriculum import RoadmapRequest
from schemas.roadmap_job import ClarificationQuestion, JobCheckpoint, JobError, StageResult
from services.roadmap.job_repository import JobRepository, JobStateError, StaleLeaseError
from sqlalchemy import delete


async def test_equivalent_decimal_requests_share_key(job_repo, job_owner) -> None:
    key = str(uuid.uuid4())
    first = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical drawing", hours_per_week="6"), key
    )
    second = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical drawing", hours_per_week="6.0"), key
    )
    assert first.id == second.id


async def test_owner_key_isolation(job_repo, job_owner, curriculum_session) -> None:
    from models.user import User

    other = User(
        id=f"usr_{uuid.uuid4().hex[:12]}", email=f"{uuid.uuid4().hex}@example.com", provider="local"
    )
    curriculum_session.add(other)
    await curriculum_session.flush()
    key = str(uuid.uuid4())
    request = RoadmapRequest(prompt="Learn practical drawing")
    first = await job_repo.create(job_owner, request, key)
    second = await job_repo.create(other.id, request, key)
    assert first.id != second.id
    assert [job.id for job in await job_repo.list_for_owner(other.id)] == [second.id]


async def test_expired_worker_cannot_commit_without_reclaim(job_repo, ready_job, clock) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    clock.advance(seconds=61)
    with pytest.raises(StaleLeaseError):
        await job_repo.checkpoint(
            claim, "understand", StageResult(checkpoint=JobCheckpoint(), summary="A late result")
        )


async def test_active_execution_ceiling_stops_heartbeat(
    job_repo, ready_job, job_owner, clock
) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    for _ in range(ready_job.limits.active_seconds // 15 - 1):
        clock.advance(seconds=15)
        assert await job_repo.heartbeat(claim, clock.now())
    clock.advance(seconds=15)
    assert await job_repo.heartbeat(claim, clock.now()) is False
    job = await job_repo.read(ready_job.id, job_owner)
    assert job.usage.active_seconds == ready_job.limits.active_seconds
    assert job.status == "failed" and job.error.next_action == "new_run"


async def test_saved_operator_ceiling_ignores_later_config(
    job_repo, ready_job, job_owner, clock
) -> None:
    from config import Settings

    original = await job_repo.read(ready_job.id, job_owner)
    job_repo.settings = Settings(ROADMAP_MAX_SEARCHES=50)
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    await job_repo.fail(
        claim,
        JobError(
            code="NETWORK", message="Temporary failure", recoverable=True, next_action="retry"
        ),
    )
    assert (await job_repo.retry(ready_job.id, job_owner)).limits == original.limits


async def test_two_worker_slots_are_reserved_across_repositories(
    job_repo, job_owner, curriculum_session, clock
) -> None:
    from models.user import User

    owners = [job_owner]
    for _ in range(2):
        user = User(
            id=f"usr_{uuid.uuid4().hex[:12]}",
            email=f"{uuid.uuid4().hex}@example.com",
            provider="local",
        )
        curriculum_session.add(user)
        owners.append(user.id)
    await curriculum_session.flush()
    for owner in owners:
        job = await job_repo.create(
            owner, RoadmapRequest(prompt="Learn practical drawing"), str(uuid.uuid4())
        )
        await job_repo.start(job.id, owner)
    await curriculum_session.commit()

    async def claim(index):
        async with get_session_factory()() as session:
            result = await JobRepository(session, clock=clock.now).claim(
                f"worker-{index}", clock.now()
            )
            await session.commit()
            return result

    try:
        results = await asyncio.gather(*(claim(index) for index in range(3)))
        assert len([result for result in results if result is not None]) == 2
        assert len({result.job_id for result in results if result is not None}) == 2
    finally:
        await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.owner_id.in_(owners)))
        await curriculum_session.commit()


async def test_create_idempotency_and_changed_request(job_repo, job_owner) -> None:
    key = str(uuid.uuid4())
    request = RoadmapRequest(prompt="Learn practical drawing for beginners")
    first = await job_repo.create(job_owner, request, key)
    assert (await job_repo.create(job_owner, request, key)).id == first.id
    assert first.startup_ready is False
    with pytest.raises(JobStateError) as error:
        await job_repo.create(
            job_owner, RoadmapRequest(prompt="Learn advanced drawing instead"), key
        )
    assert error.value.code == "IDEMPOTENCY_MISMATCH"


async def test_unstarted_setup_cannot_be_claimed(job_repo, job_owner, clock) -> None:
    await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical drawing"), str(uuid.uuid4())
    )
    assert await job_repo.claim("worker", clock.now()) is None


async def test_start_is_idempotent_and_only_one_active_per_owner(
    job_repo, ready_job, job_owner
) -> None:
    assert (await job_repo.start(ready_job.id, job_owner)).id == ready_job.id
    second = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn oil painting techniques"), str(uuid.uuid4())
    )
    with pytest.raises(JobStateError) as error:
        await job_repo.start(second.id, job_owner)
    assert error.value.code == "ACTIVE_JOB_EXISTS"


async def test_two_concurrent_starts_reserve_one_owner_slot(
    job_repo, job_owner, curriculum_session, clock
) -> None:
    first = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical drawing"), str(uuid.uuid4())
    )
    second = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn watercolor painting"), str(uuid.uuid4())
    )
    await curriculum_session.commit()

    async def start(job_id):
        async with get_session_factory()() as session:
            try:
                await JobRepository(session, clock=clock.now).start(job_id, job_owner)
                await session.commit()
                return "started"
            except JobStateError as error:
                await session.rollback()
                return error.code

    try:
        assert sorted(await asyncio.gather(start(first.id), start(second.id))) == [
            "ACTIVE_JOB_EXISTS",
            "started",
        ]
    finally:
        await curriculum_session.execute(delete(RoadmapJob).where(RoadmapJob.owner_id == job_owner))
        await curriculum_session.commit()


async def test_expired_worker_cannot_checkpoint(job_repo, ready_job, clock) -> None:
    first = await job_repo.claim("worker-a", clock.now())
    assert first is not None
    clock.advance(seconds=61)
    second = await job_repo.claim("worker-b", clock.now())
    assert second is not None and second.fence > first.fence
    with pytest.raises(StaleLeaseError):
        await job_repo.checkpoint(
            first,
            "understand",
            StageResult(checkpoint=JobCheckpoint(), summary="Understood the goal"),
        )


async def test_waiting_answer_preserves_job_and_excludes_waiting_time(
    job_repo, ready_job, job_owner, clock
) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    clock.advance(seconds=20)
    question = ClarificationQuestion(
        id="q1",
        text="What outcome matters most?",
        suggestions=["Sketch for fun", "Build a portfolio"],
    )
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(
            checkpoint=JobCheckpoint(), question=question, summary="An outcome answer is needed"
        ),
    )
    waiting = await job_repo.read(ready_job.id, job_owner)
    assert waiting.status == "awaiting_input" and waiting.usage.active_seconds == 20
    second = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn another subject"), str(uuid.uuid4())
    )
    with pytest.raises(JobStateError):
        await job_repo.start(second.id, job_owner)
    clock.advance(seconds=3600)
    with pytest.raises(JobStateError):
        await job_repo.answer(ready_job.id, job_owner, "wrong", "Sketch for fun")
    answered = await job_repo.answer(ready_job.id, job_owner, "q1", "Sketch for fun")
    assert answered.status == "queued" and answered.usage.active_seconds == 20
    assert answered.checkpoint.clarification_answers == ["Sketch for fun"]
    assert answered.checkpoint.clarification_context[0].question_id == "q1"
    assert answered.checkpoint.clarification_context[0].question == question.text
    assert answered.checkpoint.clarification_context[0].answer == "Sketch for fun"
    with pytest.raises(JobStateError):
        await job_repo.answer(ready_job.id, job_owner, "q1", "A stale answer")


async def test_question_count_cannot_exceed_three(job_repo, ready_job, job_owner, clock) -> None:
    for index in range(3):
        claim = await job_repo.claim("worker", clock.now())
        assert claim
        question = ClarificationQuestion(
            id=f"q{index}",
            text="Choose a useful outcome",
            suggestions=["General skills", "Practical project"],
        )
        job = await job_repo.read(ready_job.id, job_owner)
        await job_repo.checkpoint(
            claim,
            "understand",
            StageResult(checkpoint=job.checkpoint, question=question, summary="Answer needed"),
        )
        await job_repo.answer(ready_job.id, job_owner, question.id, "General skills")
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    with pytest.raises(JobStateError) as error:
        await job_repo.checkpoint(
            claim,
            "understand",
            StageResult(
                checkpoint=JobCheckpoint(),
                question=ClarificationQuestion(
                    id="q4", text="One more question?", suggestions=["Yes", "No"]
                ),
                summary="Question four",
            ),
        )
    assert error.value.code == "QUESTION_LIMIT"


async def test_cancel_and_late_checkpoint_are_fenced(job_repo, ready_job, job_owner, clock) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    assert (await job_repo.cancel(ready_job.id, job_owner)).status == "cancel_requested"
    with pytest.raises(StaleLeaseError):
        await job_repo.checkpoint(
            claim, "understand", StageResult(checkpoint=JobCheckpoint(), summary="Late result")
        )
    assert await job_repo.heartbeat(claim, clock.now()) is False
    assert (await job_repo.read(ready_job.id, job_owner)).status == "canceled"


async def test_cancel_before_start_is_immediate(job_repo, job_owner) -> None:
    job = await job_repo.create(
        job_owner, RoadmapRequest(prompt="Learn practical drawing"), str(uuid.uuid4())
    )
    assert (await job_repo.cancel(job.id, job_owner)).status == "canceled"


async def test_saved_usage_limits_and_receipts_survive_retry(
    job_repo, ready_job, job_owner, clock
) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    await job_repo.charge(claim, "search", "drawing-search")
    await job_repo.charge(claim, "search", "drawing-search")  # A transport retry still counts.
    await job_repo.save_receipt(
        claim,
        "drawing-search",
        {"name": "search_web", "content": "Actual evidence", "is_error": False},
    )
    assert await job_repo.get_receipt(claim, "drawing-search") is not None
    await job_repo.fail(
        claim,
        JobError(
            code="NETWORK",
            message="Search temporarily unavailable",
            recoverable=True,
            next_action="retry",
        ),
    )
    failed = await job_repo.read(ready_job.id, job_owner)
    retried = await job_repo.retry(ready_job.id, job_owner)
    assert retried.usage.searches == failed.usage.searches == 2
    assert retried.limits == failed.limits
    newer = await job_repo.claim("new-worker", clock.now())
    assert newer
    assert await job_repo.get_receipt(newer, "drawing-search") is not None


async def test_exhaustion_requires_new_run(job_repo, ready_job, job_owner, clock) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    for index in range(20):
        await job_repo.charge(claim, "search", f"search-{index}")
    with pytest.raises(JobStateError) as error:
        await job_repo.charge(claim, "search", "search-21")
    assert error.value.error.next_action == "new_run"
    await job_repo.fail(claim, error.value.error)
    with pytest.raises(JobStateError):
        await job_repo.retry(ready_job.id, job_owner)


async def test_events_are_ordered_and_private_metadata_is_filtered(
    job_repo, ready_job, job_owner
) -> None:
    first = await job_repo.append_event(
        ready_job.id,
        "activity",
        "Inspected a public source",
        {
            "tool": "fetch_source",
            "sourceUrl": "https://example.com/drawing",
            "rawPrompt": "private",
            "ownerId": job_owner,
        },
    )
    second = await job_repo.append_event(
        ready_job.id, "activity", "Loaded a registered skill", {"skill": "curriculum-design"}
    )
    assert second.sequence == first.sequence + 1
    events = await job_repo.events(ready_job.id, job_owner, first.sequence)
    assert [event.sequence for event in events] == [second.sequence]
    all_events = await job_repo.events(ready_job.id, job_owner, 0)
    assert all(
        "rawPrompt" not in event.metadata and "ownerId" not in event.metadata
        for event in all_events
    )


async def test_job_owner_cannot_be_spoofed(job_repo, ready_job) -> None:
    with pytest.raises(JobStateError):
        await job_repo.read(ready_job.id, "another-owner")


async def test_completed_stage_event_identifies_stage_that_finished(
    job_repo, ready_job, job_owner, clock
) -> None:
    claim = await job_repo.claim("worker", clock.now())
    assert claim
    await job_repo.checkpoint(
        claim, "understand", StageResult(checkpoint=JobCheckpoint(), summary="Goal understood")
    )
    events = await job_repo.events(ready_job.id, job_owner, 0)
    assert events[-1].type == "stage_completed" and events[-1].stage == "understand"
    assert (await job_repo.read(ready_job.id, job_owner)).stage == "research"


async def test_claim_announces_actual_started_stage(job_repo, ready_job, job_owner, clock):
    await job_repo.claim("observable-worker", clock.now())
    events = await job_repo.events(ready_job.id, job_owner, 0)
    assert events[-1].type == "stage_started"
    assert events[-1].stage == "understand"
    assert events[-1].summary == "Understanding your goal"


async def test_thorough_defaults_allow_reviews_but_stop_at_saved_model_ceiling(
    job_repo, ready_job, clock
):
    claim = await job_repo.claim("review-worker", clock.now())
    assert claim
    assert ready_job.limits.model_calls == 120
    for i in range(120):
        await job_repo.charge(claim, "model", f"review-call-{i}")
    with pytest.raises(JobStateError) as error:
        await job_repo.charge(claim, "model", "over-limit-review")
    assert error.value.code == "BUDGET_EXHAUSTED"


async def test_saved_valid_inventory_can_resume_schema_failure_without_resetting_usage(
    job_repo, ready_job, job_owner, clock, small_profile, sources
):
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.prompts import ResearchReview

    claim = await job_repo.claim("research-worker", clock.now())
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(checkpoint=JobCheckpoint(profile=small_profile), summary="Goal understood"),
    )
    claim = await job_repo.claim("research-worker", clock.now())
    row, _ = await job_repo._claimed(claim)
    checkpoint = JobCheckpoint(
        profile=small_profile,
        sources=sources,
        pending_inventory_stage="research",
        pending_inventory_review=ResearchReview(
            source_ids=["s1", "s2"],
            coverage_notes=["Compared actual sources"],
            coverage_topics=[CoverageTopic(id="rag", title="RAG", area="AI", source_ids=["s1"])],
        ).model_dump(mode="json", by_alias=True),
    )
    row.checkpoint = checkpoint.model_dump(mode="json")
    await job_repo.session.flush()
    await job_repo.charge(claim, "model", "prior-inventory-call")
    await job_repo.fail(
        claim,
        JobError(
            code="STAGE_OUTPUT_INVALID",
            message="Legacy saved comparison needs inventory repair",
            recoverable=False,
            next_action="new_run",
        ),
    )
    resumed = await job_repo.retry(ready_job.id, job_owner)
    assert resumed.status == "queued"
    assert resumed.usage.model_calls == 1
    assert resumed.limits == ready_job.limits


async def test_completed_inventory_areas_make_schema_failure_resumable(
    job_repo, ready_job, job_owner, clock, small_profile, sources
):
    from schemas.roadmap_job import CoverageTopic

    claim = await job_repo.claim("research-worker", clock.now())
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(checkpoint=JobCheckpoint(profile=small_profile), summary="Goal understood"),
    )
    claim = await job_repo.claim("research-worker", clock.now())
    checkpoint = JobCheckpoint(
        profile=small_profile,
        sources=sources,
        coverage_inventory_plan={
            "sourceIds": ["s1", "s2"],
            "coverageNotes": ["Compared actual sources"],
            "areas": [{"title": "RAG", "scope": "Retrieval augmented generation"}],
        },
        coverage_inventory_next_area=1,
        coverage_topics=[
            CoverageTopic(id="rag", title="RAG foundations", area="RAG", source_ids=["s1"])
        ],
    )
    row, _ = await job_repo._claimed(claim)
    row.stage = "research"
    row.checkpoint = checkpoint.model_dump(mode="json", by_alias=True)
    await job_repo.session.flush()
    await job_repo.charge(claim, "model", "prior-area-call")
    await job_repo.fail(
        claim,
        JobError(
            code="STAGE_OUTPUT_INVALID",
            message="An area needs another correction",
            recoverable=True,
            next_action="retry",
        ),
    )
    resumed = await job_repo.retry(ready_job.id, job_owner)
    assert resumed.status == "queued"
    assert resumed.usage.model_calls == 1
    assert resumed.checkpoint.coverage_inventory_next_area == 1


async def test_researched_inventory_can_resume_outline_schema_failure(
    job_repo, ready_job, job_owner, clock, small_profile, sources
):
    from schemas.roadmap_job import CoverageTopic

    claim = await job_repo.claim("research-worker", clock.now())
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(checkpoint=JobCheckpoint(profile=small_profile), summary="Goal understood"),
    )
    claim = await job_repo.claim("research-worker", clock.now())
    checkpoint = JobCheckpoint(
        profile=small_profile,
        sources=sources,
        coverage_topics=[
            CoverageTopic(id="retrieval", title="Retrieval", area="RAG", source_ids=["s1"])
        ],
        completed_stages=["understand", "research"],
    )
    await job_repo.checkpoint(
        claim, "research", StageResult(checkpoint=checkpoint, summary="Inventory researched")
    )
    claim = await job_repo.claim("research-worker", clock.now())
    await job_repo.charge(claim, "model", "outline-call")
    await job_repo.fail(
        claim,
        JobError(
            code="STAGE_OUTPUT_INVALID",
            message="Outline relationships used unrecognized topic handles",
            recoverable=False,
            next_action="new_run",
        ),
    )

    resumed = await job_repo.retry(ready_job.id, job_owner)

    assert resumed.status == "queued"
    assert resumed.usage.model_calls == 1
    assert resumed.checkpoint.coverage_topics == checkpoint.coverage_topics


async def test_saved_reference_coverage_review_can_resume_legacy_failure(
    job_repo, ready_job, job_owner, clock, small_profile, sources
):
    from schemas.roadmap_job import CoverageTopic
    from services.roadmap.prompts import ResearchReview

    claim = await job_repo.claim("research-worker", clock.now())
    await job_repo.checkpoint(
        claim,
        "understand",
        StageResult(checkpoint=JobCheckpoint(profile=small_profile), summary="Goal understood"),
    )
    claim = await job_repo.claim("research-worker", clock.now())
    checkpoint = JobCheckpoint(
        profile=small_profile,
        sources=sources,
        coverage_inventory_plan={
            "sourceIds": ["s1", "s2"],
            "coverageNotes": ["Compared actual sources"],
            "areas": [{"title": "RAG", "scope": "Retrieval augmented generation"}],
        },
        coverage_inventory_next_area=1,
        pending_inventory_stage="research",
        pending_inventory_review=ResearchReview(
            source_ids=["s1", "s2"],
            coverage_notes=["Compared actual sources"],
            coverage_topics=[CoverageTopic(id="rag", title="RAG", area="RAG", source_ids=["s1"])],
        ).model_dump(mode="json", by_alias=True),
    )
    row, _ = await job_repo._claimed(claim)
    row.stage = "research"
    row.checkpoint = checkpoint.model_dump(mode="json", by_alias=True)
    await job_repo.session.flush()
    await job_repo.fail(
        claim,
        JobError(
            code="REFERENCE_COVERAGE_INCOMPLETE",
            message="Saved review needs missing competency repair",
            recoverable=False,
            next_action="new_run",
        ),
    )
    restored = JobCheckpoint.model_validate(row.checkpoint)
    assert row.stage == "research"
    assert row.error["code"] == "REFERENCE_COVERAGE_INCOMPLETE"
    assert restored.pending_inventory_stage == "research"
    resumed = await job_repo.retry(ready_job.id, job_owner)
    assert resumed.status == "queued"
    assert resumed.checkpoint.pending_inventory_stage == "research"
