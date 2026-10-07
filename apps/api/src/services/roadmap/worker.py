"""Standalone durable worker. External stages never share a session with heartbeats."""

import asyncio
import signal
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

import structlog
from config import Settings, get_settings
from database import get_engine, get_session_factory
from schemas.roadmap_job import Claim, JobError, JobSnapshot, StageName, StageResult
from services.roadmap.job_repository import JobRepository, JobStateError, StaleLeaseError
from services.roadmap.publication import PublicationService
from services.roadmap.references import ReferenceService
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()
SessionFactory = Callable[[], AsyncSession]


class StageExecutor(Protocol):
    async def run(self, stage: StageName, job: JobSnapshot, claim: Claim) -> StageResult: ...


class RoadmapWorker:
    def __init__(
        self,
        session_factory: SessionFactory,
        executor: StageExecutor,
        *,
        clock: Callable[[], datetime] | None = None,
        settings: Settings | None = None,
        heartbeat_interval: float | None = None,
    ) -> None:
        self.sessions = session_factory
        self.executor = executor
        self.clock = clock
        self.settings = settings or get_settings()
        self.heartbeat_interval = heartbeat_interval
        self.stopping = asyncio.Event()

    def _repo(self, session: AsyncSession) -> JobRepository:
        return JobRepository(session, clock=self.clock, settings=self.settings)

    async def _heartbeat(self, claim: Claim) -> bool:
        async with self.sessions() as session:
            alive = await self._repo(session).heartbeat(claim, datetime.now(timezone.utc))
            await session.commit()
            return alive

    async def _release(self, claim: Claim) -> None:
        try:
            async with self.sessions() as session:
                await self._repo(session).release(claim)
                await session.commit()
        except Exception as error:
            # Expiration remains the recovery path if shutdown loses DB connectivity.
            logger.warning(
                "roadmap_worker_release_deferred",
                job_id=claim.job_id,
                error_type=type(error).__name__,
            )

    async def _execute(self, claim: Claim, job: JobSnapshot) -> StageResult | None:
        done = asyncio.Event()
        lost = False
        result: StageResult | None = None
        failure: Exception | None = None
        interval = self.heartbeat_interval or min(
            job.limits.heartbeat_seconds, job.limits.lease_seconds / 3
        )

        async def invoke() -> None:
            nonlocal result, failure
            try:
                result = StageResult.model_validate(
                    await self.executor.run(claim.stage, job, claim)
                )
            except Exception as error:
                failure = error
            finally:
                done.set()

        async def heartbeat() -> None:
            nonlocal lost
            while not done.is_set():
                try:
                    await asyncio.wait_for(done.wait(), interval)
                    return
                except TimeoutError:
                    pass
                try:
                    alive = await self._heartbeat(claim)
                except Exception as error:
                    logger.warning(
                        "roadmap_heartbeat_interrupted",
                        job_id=claim.job_id,
                        error_type=type(error).__name__,
                    )
                    alive = False
                if not alive:
                    lost = True
                    stage_task.cancel()
                    return

        async with asyncio.TaskGroup() as group:
            stage_task = group.create_task(invoke())
            group.create_task(heartbeat())
        if lost:
            return None
        if failure is not None:
            raise failure
        if result is None:
            raise asyncio.CancelledError()
        return result

    async def run_once(self, worker_id: str) -> bool:
        if self.stopping.is_set():
            return False
        async with self.sessions() as session:
            repo = self._repo(session)
            claim = await repo.claim(worker_id, datetime.now(timezone.utc))
            if claim is None:
                await session.commit()
                return False
            # Snapshot is private and detached before any external work begins.
            row = await repo._row(claim.job_id)
            job = repo._snapshot(row)
            await session.commit()
        try:
            if claim.stage == "publish":
                async with self.sessions() as session:
                    await PublicationService(session, clock=self.clock).publish(claim)
                    await session.commit()
                return True
            result = await self._execute(claim, job)
            if result is None:
                return True
            async with self.sessions() as session:
                await self._repo(session).checkpoint(claim, claim.stage, result)
                await session.commit()
        except asyncio.CancelledError:
            # TaskGroup has canceled/awaited the external call; it cannot commit late.
            await asyncio.shield(self._release(claim))
            raise
        except StaleLeaseError:
            await self._heartbeat(claim)  # Finalize a cancellation; never alter a newer fence.
            logger.info("roadmap_late_stage_discarded", job_id=claim.job_id, stage=claim.stage)
        except Exception as error:
            if isinstance(error, JobStateError):
                job_error = error.error
            elif isinstance(error, ValueError):
                job_error = JobError(
                    code="INVALID_STAGE_RESULT",
                    message="The stage result could not be validated. Start a new run.",
                    recoverable=False,
                    next_action="new_run",
                )
            else:
                job_error = JobError(
                    code="STAGE_FAILED",
                    message="A service was interrupted. Retry to continue saved progress.",
                    recoverable=True,
                    next_action="retry",
                )
            try:
                async with self.sessions() as session:
                    await self._repo(session).fail(claim, job_error)
                    await session.commit()
            except StaleLeaseError:
                await self._heartbeat(claim)
            logger.warning(
                "roadmap_stage_failed",
                job_id=claim.job_id,
                stage=claim.stage,
                code=job_error.code,
                error_type=type(error).__name__,
            )
        return True

    def request_stop(self) -> None:
        self.stopping.set()

    async def _slot(self, worker_id: str) -> None:
        while not self.stopping.is_set():
            try:
                worked = await self.run_once(worker_id)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.warning("roadmap_worker_poll_failed", error_type=type(error).__name__)
                worked = False
            if not worked:
                try:
                    await asyncio.wait_for(self.stopping.wait(), 1)
                except TimeoutError:
                    pass

    async def _cleanup(self) -> None:
        while not self.stopping.is_set():
            try:
                async with self.sessions() as session:
                    repo = self._repo(session)
                    count = await ReferenceService(
                        session, Path(self.settings.ROADMAP_REFERENCE_DIR)
                    ).expire(await repo._now())
                    await session.commit()
                    if count:
                        logger.info("roadmap_references_expired", count=count)
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.warning("roadmap_cleanup_deferred", error_type=type(error).__name__)
            try:
                await asyncio.wait_for(self.stopping.wait(), 3600)
            except TimeoutError:
                pass

    async def serve(self) -> None:
        identity = f"roadmap-{uuid.uuid4().hex[:12]}"
        async with asyncio.TaskGroup() as group:
            tasks = [
                group.create_task(self._slot(f"{identity}-{index}"))
                for index in range(self.settings.ROADMAP_WORKER_SLOTS)
            ]
            tasks.append(group.create_task(self._cleanup()))
            await self.stopping.wait()
            for task in tasks:
                task.cancel()


async def main() -> None:
    # Imported at process entry: typed orchestration is installed by the following plan tasks.
    from services.roadmap.stages import RoadmapStageExecutor

    worker = RoadmapWorker(get_session_factory(), RoadmapStageExecutor(get_session_factory()))
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(signum, worker.request_stop)
    try:
        await worker.serve()
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
