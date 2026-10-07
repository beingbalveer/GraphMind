import asyncio

from database import get_session_factory
from models.workspace import Workspace
from schemas.roadmap_job import ClarificationQuestion, JobCheckpoint, StageResult
from services.roadmap.job_repository import JobRepository
from services.roadmap.worker import RoadmapWorker
from sqlalchemy import func, select


async def read(job):
    async with get_session_factory()() as session:
        return await JobRepository(session).read(job.id, job.owner_id)


async def test_worker_restart_reuses_completed_research(
    worker, worker_job, scripted_executor, clock
):
    assert await worker.run_once("worker-one")
    assert await worker.run_once("worker-one")
    assert (await read(worker_job)).stage == "compose"
    restarted = RoadmapWorker(
        get_session_factory(), scripted_executor, clock=clock.now, heartbeat_interval=0.01
    )
    assert await restarted.run_once("worker-two")
    assert scripted_executor.calls == ["understand", "research", "compose"]
    assert (await read(worker_job)).stage == "personalize"


async def test_awaiting_input_releases_worker_and_keeps_saved_stage(
    worker, worker_job, scripted_executor
):
    scripted_executor.results["understand"] = StageResult(
        checkpoint=JobCheckpoint(),
        summary="Outcome needed",
        question=ClarificationQuestion(
            id="q1", text="What will you build?", suggestions=["Portfolio", "Personal project"]
        ),
    )
    assert await worker.run_once("worker")
    waiting = await read(worker_job)
    assert waiting.status == "awaiting_input" and waiting.stage == "understand"
    assert await worker.run_once("worker") is False


async def test_cancel_during_blocked_call_discards_late_result(
    worker, worker_job, scripted_executor
):
    scripted_executor.block_stage = "understand"
    task = asyncio.create_task(worker.run_once("worker"))
    await asyncio.wait_for(scripted_executor.started.wait(), 2)
    async with get_session_factory()() as session:
        await JobRepository(session).cancel(worker_job.id, worker_job.owner_id)
        await session.commit()
    scripted_executor.release.set()
    await asyncio.wait_for(task, 2)
    assert (await read(worker_job)).status == "canceled"
    async with get_session_factory()() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Workspace)
                .where(Workspace.owner_id == worker_job.owner_id)
            )
            == 0
        )


async def test_expired_worker_discards_stage_after_new_fence(
    worker, worker_job, scripted_executor, clock
):
    scripted_executor.block_stage = "understand"
    task = asyncio.create_task(worker.run_once("old-worker"))
    await asyncio.wait_for(scripted_executor.started.wait(), 2)
    clock.advance(seconds=61)
    async with get_session_factory()() as session:
        newer = await JobRepository(session, clock=clock.now).claim("new-worker", clock.now())
        await session.commit()
    assert newer
    scripted_executor.release.set()
    await asyncio.wait_for(task, 2)
    job = await read(worker_job)
    assert job.stage == "understand" and job.checkpoint.completed_stages == []


async def test_worker_failure_is_recoverable_without_losing_checkpoint(
    worker, worker_job, scripted_executor
):
    await worker.run_once("worker")
    scripted_executor.failure = RuntimeError("temporary provider failure")
    await worker.run_once("worker")
    job = await read(worker_job)
    assert job.status == "failed" and job.error.recoverable and job.stage == "research"
    assert job.checkpoint.completed_stages == ["understand"]


async def test_shutdown_cancellation_releases_stage_and_can_resume(
    worker, worker_job, scripted_executor
):
    scripted_executor.block_stage = "understand"
    task = asyncio.create_task(worker.run_once("worker"))
    await asyncio.wait_for(scripted_executor.started.wait(), 2)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    job = await read(worker_job)
    assert job.status == "queued" and job.stage == "understand"


async def test_racing_workers_publish_one_workspace(worker, worker_job, scripted_executor, clock):
    for _ in range(5):
        assert await worker.run_once("first-worker")
    second = RoadmapWorker(
        get_session_factory(), scripted_executor, clock=clock.now, heartbeat_interval=0.01
    )
    results = await asyncio.gather(
        worker.run_once("first-worker"), second.run_once("second-worker")
    )
    assert sorted(results) == [False, True]
    job = await read(worker_job)
    assert job.status == "completed" and job.result.kind == "published"
    async with get_session_factory()() as session:
        assert (
            await session.scalar(
                select(func.count())
                .select_from(Workspace)
                .where(Workspace.owner_id == worker_job.owner_id)
            )
            == 1
        )


async def test_serve_shutdown_stops_claims_and_releases_blocked_stage(
    worker, worker_job, scripted_executor
):
    scripted_executor.block_stage = "understand"
    task = asyncio.create_task(worker.serve())
    await asyncio.wait_for(scripted_executor.started.wait(), 2)
    worker.request_stop()
    await asyncio.wait_for(task, 2)
    assert await worker.run_once("after-shutdown") is False
    assert (await read(worker_job)).status == "queued"
