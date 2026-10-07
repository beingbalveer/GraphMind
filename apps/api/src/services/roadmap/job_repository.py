"""Durable lifecycle primitives. Callers own transactions; no network work under locks."""

import hashlib
import json
from collections.abc import Callable
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal

import structlog
from config import Settings, get_settings
from models.roadmap_job import RoadmapJob, RoadmapJobEvent, RoadmapToolReceipt
from models.user import User
from pydantic import JsonValue
from schemas.curriculum import RoadmapRequest
from schemas.roadmap_job import (
    Claim,
    JobCheckpoint,
    JobError,
    JobEventData,
    JobLimits,
    JobOperation,
    JobSnapshot,
    JobUsage,
    StageName,
    StageResult,
)
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()
STAGES: tuple[StageName, ...] = (
    "understand",
    "research",
    "compose",
    "personalize",
    "validate",
    "publish",
)
ACTIVE = ("queued", "running", "awaiting_input", "cancel_requested")
METADATA_KEYS = {
    "tool",
    "skill",
    "sourceUrl",
    "sourceTitle",
    "sourceId",
    "referenceId",
    "locator",
    "provider",
    "count",
    "limit",
    "code",
    "attempt",
    "workspaceId",
    "revisionId",
}
CATEGORIES = {
    "model": "model_calls",
    "search": "searches",
    "fetch": "unique_fetches",
    "repair": "repair_attempts",
}


class JobStateError(ValueError):
    def __init__(
        self,
        code: str,
        message: str = "This job cannot perform that action",
        *,
        error: JobError | None = None,
    ) -> None:
        self.code = code
        self.error = error or JobError(
            code=code, message=message, recoverable=False, next_action="new_run"
        )
        super().__init__(message)


class StaleLeaseError(JobStateError):
    def __init__(self) -> None:
        super().__init__("STALE_LEASE", "This worker no longer owns the running stage")


def saved_limits(settings: Settings) -> JobLimits:
    return JobLimits(
        model_calls=settings.ROADMAP_MAX_MODEL_CALLS,
        searches=settings.ROADMAP_MAX_SEARCHES,
        unique_fetches=settings.ROADMAP_MAX_FETCHES,
        repair_attempts=settings.ROADMAP_MAX_REPAIRS,
        active_seconds=settings.ROADMAP_MAX_ACTIVE_SECONDS,
        lease_seconds=settings.ROADMAP_LEASE_SECONDS,
        heartbeat_seconds=settings.ROADMAP_HEARTBEAT_SECONDS,
        worker_slots=settings.ROADMAP_WORKER_SLOTS,
    )


def canonical_request(
    request: RoadmapRequest, operation: JobOperation, base_revision_id: str | None
) -> str:
    def normalize(value: object) -> object:
        if isinstance(value, Decimal):
            return format(value.normalize(), "f")
        if isinstance(value, dict):
            return {key: normalize(item) for key, item in value.items()}
        if isinstance(value, list):
            return [normalize(item) for item in value]
        return value

    data = normalize(
        {
            "request": request.model_dump(),
            "operation": operation,
            "base_revision_id": base_revision_id,
        }
    )
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class JobRepository:
    def __init__(
        self,
        session: AsyncSession,
        *,
        clock: Callable[[], datetime] | None = None,
        settings: Settings | None = None,
    ) -> None:
        self.session = session
        self.clock = clock
        self.settings = settings or get_settings()

    async def _now(self) -> datetime:
        if self.clock is not None:
            return self.clock()
        value = (await self.session.execute(select(func.clock_timestamp()))).scalar_one()
        if not isinstance(value, datetime):
            raise RuntimeError("Database clock did not return a timestamp")
        return value

    async def _row(self, job_id: str, owner_id: str | None = None) -> RoadmapJob:
        row = await self.session.scalar(
            select(RoadmapJob)
            .where(RoadmapJob.id == job_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if row is None or owner_id is not None and row.owner_id != owner_id:
            raise JobStateError("JOB_NOT_FOUND", "Roadmap job not found")
        return row

    async def _owner_lock(self, owner_id: str) -> None:
        owner = await self.session.scalar(
            select(User).where(User.id == owner_id, User.is_active).with_for_update()
        )
        if owner is None:
            raise JobStateError("JOB_NOT_FOUND", "Roadmap job not found")

    async def _available(self, owner_id: str, job_id: str) -> None:
        existing = await self.session.scalar(
            select(RoadmapJob.id).where(
                RoadmapJob.owner_id == owner_id,
                RoadmapJob.id != job_id,
                RoadmapJob.startup_ready,
                RoadmapJob.status.in_(ACTIVE),
            )
        )
        if existing is not None:
            raise JobStateError("ACTIVE_JOB_EXISTS", "Finish or cancel your active roadmap first")

    def _snapshot(self, row: RoadmapJob) -> JobSnapshot:
        return JobSnapshot.model_validate(
            {
                "id": row.id,
                "owner_id": row.owner_id,
                "operation": row.operation,
                "request": row.request,
                "status": row.status,
                "stage": row.stage,
                "startup_ready": row.startup_ready,
                "checkpoint": row.checkpoint,
                "usage": row.usage,
                "limits": row.limits or saved_limits(self.settings).model_dump(),
                "question": row.question,
                "question_count": row.question_count,
                "error": row.error,
                "result": row.result,
                "last_sequence": row.last_sequence,
                "base_revision_id": row.base_revision_id,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
        )

    async def create(
        self,
        owner_id: str,
        request: RoadmapRequest,
        key: str,
        operation: JobOperation = "generate",
        base_revision_id: str | None = None,
    ) -> JobSnapshot:
        if not key.strip() or len(key) > 128:
            raise JobStateError("INVALID_IDEMPOTENCY_KEY")
        if (operation == "refine") != (base_revision_id is not None):
            raise JobStateError("INVALID_OPERATION", "Refinement requires a base revision")
        await self._owner_lock(owner_id)
        digest = canonical_request(request, operation, base_revision_id)
        row = await self.session.scalar(
            select(RoadmapJob).where(
                RoadmapJob.owner_id == owner_id,
                RoadmapJob.operation == operation,
                RoadmapJob.idempotency_key == key,
            )
        )
        if row is not None:
            if row.request_hash != digest:
                raise JobStateError(
                    "IDEMPOTENCY_MISMATCH", "This request key was used for different inputs"
                )
            return self._snapshot(row)
        now = await self._now()
        row = RoadmapJob(
            owner_id=owner_id,
            operation=operation,
            idempotency_key=key,
            request_hash=digest,
            request=request.model_dump(mode="json"),
            checkpoint=JobCheckpoint().model_dump(mode="json"),
            usage=JobUsage().model_dump(),
            base_revision_id=base_revision_id,
            created_at=now,
            updated_at=now,
        )
        self.session.add(row)
        await self.session.flush()
        return self._snapshot(row)

    async def start(self, job_id: str, owner_id: str) -> JobSnapshot:
        await self._owner_lock(owner_id)
        row = await self._row(job_id, owner_id)
        if row.startup_ready:
            return self._snapshot(row)
        if row.status != "queued":
            raise JobStateError("INVALID_STATE")
        await self._available(owner_id, job_id)
        row.limits = saved_limits(self.settings).model_dump()
        row.startup_ready = True
        await self._event(row, "started", "Preparing your learning plan", {})
        await self.session.flush()
        return self._snapshot(row)

    def _account(self, row: RoadmapJob, now: datetime) -> JobUsage:
        usage = JobUsage.model_validate(row.usage)
        if row.active_since is not None and row.lease_until is not None:
            end = min(now, row.lease_until)
            usage.active_seconds += max(0, (end - row.active_since).total_seconds())
            row.active_since = end
        row.usage = usage.model_dump()
        row.updated_at = now
        return usage

    def _release(self, row: RoadmapJob) -> None:
        row.worker_id = None
        row.lease_until = None
        row.active_since = None

    def _budget(self, usage: JobUsage, limits: JobLimits) -> bool:
        return all(
            getattr(usage, name) < getattr(limits, name)
            for name in (*CATEGORIES.values(), "active_seconds")
        )

    async def claim(self, worker_id: str, now: datetime) -> Claim | None:
        # Serialize only the short global slot reservation, across API/worker processes.
        await self.session.execute(text("SELECT pg_advisory_xact_lock(73492103)"))
        now = await self._now()
        expired_cancels = (
            await self.session.scalars(
                select(RoadmapJob)
                .where(RoadmapJob.status == "cancel_requested", RoadmapJob.lease_until <= now)
                .with_for_update(skip_locked=True)
            )
        ).all()
        for canceled in expired_cancels:
            self._account(canceled, now)
            canceled.status = "canceled"
            self._release(canceled)
            await self._event(canceled, "canceled", "Roadmap generation canceled", {})
        await self.session.flush()
        running = await self.session.scalar(
            select(func.count())
            .select_from(RoadmapJob)
            .where(
                RoadmapJob.status.in_(("running", "cancel_requested")), RoadmapJob.lease_until > now
            )
        )
        if (running or 0) >= self.settings.ROADMAP_WORKER_SLOTS:
            return None
        row = await self.session.scalar(
            select(RoadmapJob)
            .where(
                RoadmapJob.startup_ready,
                or_(
                    RoadmapJob.status == "queued",
                    and_(RoadmapJob.status == "running", RoadmapJob.lease_until <= now),
                ),
            )
            .order_by(RoadmapJob.created_at, RoadmapJob.id)
            .with_for_update(skip_locked=True)
            .limit(1)
            .execution_options(populate_existing=True)
        )
        if row is None:
            return None
        usage = self._account(row, now)
        limits = JobLimits.model_validate(row.limits)
        if usage.active_seconds >= limits.active_seconds:
            row.status = "failed"
            row.error = self._exhausted().error.model_dump(mode="json")
            self._release(row)
            await self._event(
                row, "failed", "The research time limit was reached", {"code": "BUDGET_EXHAUSTED"}
            )
            return None
        row.status = "running"
        row.fence += 1
        row.worker_id = worker_id[:128]
        row.active_since = now
        row.lease_until = now + timedelta(seconds=limits.lease_seconds)
        row.updated_at = now
        await self.session.flush()
        return Claim.model_validate(
            {
                "job_id": row.id,
                "fence": row.fence,
                "lease_until": row.lease_until,
                "stage": row.stage,
            }
        )

    async def _claimed(
        self, claim: Claim, *, cancel_allowed: bool = False
    ) -> tuple[RoadmapJob, datetime]:
        row = await self._row(claim.job_id)
        now = await self._now()
        allowed = ("running", "cancel_requested") if cancel_allowed else ("running",)
        if (
            row.status not in allowed
            or row.fence != claim.fence
            or row.stage != claim.stage
            or row.lease_until is None
            or row.lease_until <= now
        ):
            raise StaleLeaseError()
        self._account(row, now)
        return row, now

    async def heartbeat(self, claim: Claim, now: datetime) -> bool:
        try:
            row, now = await self._claimed(claim, cancel_allowed=True)
        except StaleLeaseError:
            return False
        if row.status == "cancel_requested":
            row.status = "canceled"
            self._release(row)
            await self._event(row, "canceled", "Roadmap generation canceled", {})
            return False
        limits = JobLimits.model_validate(row.limits)
        if JobUsage.model_validate(row.usage).active_seconds >= limits.active_seconds:
            row.status = "failed"
            row.error = self._exhausted().error.model_dump(mode="json")
            self._release(row)
            await self._event(
                row, "failed", "The research time limit was reached", {"code": "BUDGET_EXHAUSTED"}
            )
            return False
        row.lease_until = now + timedelta(seconds=limits.lease_seconds)
        await self.session.flush()
        return True

    async def checkpoint(self, claim: Claim, stage: StageName, result: StageResult) -> None:
        row, _ = await self._claimed(claim)
        if stage != claim.stage or stage == "publish":
            raise JobStateError("INVALID_STAGE", "Publication must commit its result atomically")
        self._execution_budget(row)
        prior = JobCheckpoint.model_validate(row.checkpoint)
        checkpoint = result.checkpoint.model_copy(deep=True)
        checkpoint.completed_stages = prior.completed_stages.copy()
        checkpoint.clarification_answers = prior.clarification_answers.copy()
        if result.question is not None:
            if row.question_count >= 3:
                raise JobStateError(
                    "QUESTION_LIMIT", "Use the available answers and stated assumptions"
                )
            row.question_count += 1
            row.question = result.question.model_dump(mode="json")
            row.status = "awaiting_input"
        else:
            checkpoint.completed_stages.append(stage)
            row.stage = STAGES[STAGES.index(stage) + 1]
            row.status = "queued"
        row.checkpoint = checkpoint.model_dump(mode="json")
        self._release(row)
        await self._event(
            row,
            "awaiting_input" if result.question else "stage_completed",
            result.summary,
            {},
            stage=stage,
        )
        await self.session.flush()

    async def answer(
        self, job_id: str, owner_id: str, question_id: str, answer: str
    ) -> JobSnapshot:
        row = await self._row(job_id, owner_id)
        if (
            row.status != "awaiting_input"
            or row.question is None
            or row.question["id"] != question_id
        ):
            raise JobStateError(
                "QUESTION_MISMATCH", "That question is no longer awaiting an answer"
            )
        answer = answer.strip()
        if not 1 <= len(answer) <= 4000:
            raise JobStateError("INVALID_ANSWER", "Answer using 1–4000 characters")
        checkpoint = JobCheckpoint.model_validate(row.checkpoint)
        checkpoint.clarification_answers.append(answer)
        row.checkpoint = checkpoint.model_dump(mode="json")
        row.question = None
        row.status = "queued"
        await self._event(row, "answered", "Continuing with your answer", {})
        await self.session.flush()
        return self._snapshot(row)

    async def cancel(self, job_id: str, owner_id: str) -> JobSnapshot:
        row = await self._row(job_id, owner_id)
        if row.status in ("completed", "canceled", "failed"):
            return self._snapshot(row)
        if row.status == "running":
            row.status = "cancel_requested"
        elif row.status != "cancel_requested":
            row.status = "canceled"
            row.question = None
            self._release(row)
        await self._event(
            row,
            "cancel_requested" if row.status == "cancel_requested" else "canceled",
            "Stopping roadmap generation",
            {},
        )
        await self.session.flush()
        return self._snapshot(row)

    async def retry(self, job_id: str, owner_id: str) -> JobSnapshot:
        await self._owner_lock(owner_id)
        row = await self._row(job_id, owner_id)
        if row.status == "completed":
            return self._snapshot(row)
        if row.status not in ("failed", "canceled"):
            raise JobStateError("INVALID_STATE")
        if row.status == "failed" and (row.error is None or not row.error.get("recoverable")):
            raise JobStateError("NOT_RECOVERABLE")
        limits = JobLimits.model_validate(row.limits) if row.limits else saved_limits(self.settings)
        if not self._budget(JobUsage.model_validate(row.usage), limits):
            raise self._exhausted()
        await self._available(owner_id, job_id)
        row.status = "queued"
        row.startup_ready = True
        row.limits = limits.model_dump()
        row.error = None
        row.question = None
        self._release(row)
        await self._event(row, "retried", "Resuming saved roadmap progress", {})
        await self.session.flush()
        return self._snapshot(row)

    async def fail(self, claim: Claim, error: JobError) -> None:
        row, _ = await self._claimed(claim)
        row.status = "failed"
        row.error = error.model_dump(mode="json")
        self._release(row)
        await self._event(row, "failed", error.message, {"code": error.code})
        await self.session.flush()

    async def release(self, claim: Claim) -> bool:
        """Called only after the worker has stopped the external task and discarded its result."""
        try:
            row, _ = await self._claimed(claim, cancel_allowed=True)
        except StaleLeaseError:
            return False
        row.status = "canceled" if row.status == "cancel_requested" else "queued"
        self._release(row)
        await self._event(
            row, "interrupted", "Saved progress will resume with an available worker", {}
        )
        await self.session.flush()
        return True

    def _exhausted(self) -> JobStateError:
        return JobStateError(
            "BUDGET_EXHAUSTED", "This run reached its research limit. Start a new run."
        )

    def _execution_budget(self, row: RoadmapJob) -> None:
        if (
            JobUsage.model_validate(row.usage).active_seconds
            >= JobLimits.model_validate(row.limits).active_seconds
        ):
            raise self._exhausted()

    async def charge(
        self,
        claim: Claim,
        category: Literal["model", "search", "fetch", "repair"],
        operation_key: str,
    ) -> None:
        row, _ = await self._claimed(claim)
        self._execution_budget(row)
        usage = JobUsage.model_validate(row.usage)
        limits = JobLimits.model_validate(row.limits)
        field = CATEGORIES[category]
        if getattr(usage, field) >= getattr(limits, field):
            raise self._exhausted()
        if not operation_key or len(operation_key) > 128:
            raise JobStateError("INVALID_OPERATION_KEY")
        setattr(usage, field, getattr(usage, field) + 1)
        row.usage = usage.model_dump()
        receipt = await self.session.get(RoadmapToolReceipt, (row.id, row.stage, operation_key))
        if receipt is None:
            receipt = RoadmapToolReceipt(
                job_id=row.id,
                stage=row.stage,
                operation_key=operation_key,
                reservations={category: 1},
            )
            self.session.add(receipt)
        else:
            receipt.reservations = {
                **receipt.reservations,
                category: receipt.reservations.get(category, 0) + 1,
            }
        await self.session.flush()

    async def get_receipt(self, claim: Claim, operation_key: str) -> dict[str, JsonValue] | None:
        await self._claimed(claim)
        receipt = await self.session.get(
            RoadmapToolReceipt, (claim.job_id, claim.stage, operation_key)
        )
        return receipt.result if receipt is not None else None

    async def save_receipt(
        self, claim: Claim, operation_key: str, result: dict[str, JsonValue]
    ) -> None:
        await self._claimed(claim)
        receipt = await self.session.get(
            RoadmapToolReceipt, (claim.job_id, claim.stage, operation_key)
        )
        if receipt is None:
            raise JobStateError("UNRESERVED_OPERATION", "Reserve usage before executing a tool")
        # Validated worker results only; reference content never appears in public event payloads.
        if len(json.dumps(result).encode()) > 2 * 1024 * 1024:
            raise JobStateError("RECEIPT_LIMIT")
        if receipt.result is None:
            receipt.result = result
        elif receipt.result != result:
            raise JobStateError("RECEIPT_IMMUTABLE")
        await self.session.flush()

    async def read(self, job_id: str, owner_id: str) -> JobSnapshot:
        row = await self.session.scalar(
            select(RoadmapJob)
            .where(RoadmapJob.id == job_id, RoadmapJob.owner_id == owner_id)
            .execution_options(populate_existing=True)
        )
        if row is None:
            raise JobStateError("JOB_NOT_FOUND", "Roadmap job not found")
        return self._snapshot(row)

    async def list_for_owner(self, owner_id: str) -> list[JobSnapshot]:
        rows = (
            await self.session.scalars(
                select(RoadmapJob)
                .where(RoadmapJob.owner_id == owner_id)
                .order_by(RoadmapJob.created_at.desc())
                .limit(100)
            )
        ).all()
        return [self._snapshot(row) for row in rows]

    async def events(self, job_id: str, owner_id: str, after: int) -> list[JobEventData]:
        await self.read(job_id, owner_id)
        rows = (
            await self.session.scalars(
                select(RoadmapJobEvent)
                .where(RoadmapJobEvent.job_id == job_id, RoadmapJobEvent.sequence > max(0, after))
                .order_by(RoadmapJobEvent.sequence)
                .limit(200)
            )
        ).all()
        return [self._event_data(row) for row in rows]

    def _event_data(self, event: RoadmapJobEvent) -> JobEventData:
        return JobEventData.model_validate(
            {
                "sequence": event.sequence,
                "stage": event.stage,
                "type": event.type,
                "summary": event.summary,
                "metadata": event.details,
                "created_at": event.created_at,
            }
        )

    async def _event(
        self,
        row: RoadmapJob,
        event_type: str,
        summary: str,
        metadata: dict[str, JsonValue],
        *,
        stage: StageName | None = None,
    ) -> JobEventData:
        if not event_type or len(event_type) > 32 or not 1 <= len(summary) <= 500:
            raise JobStateError("INVALID_EVENT")
        safe: dict[str, JsonValue] = {}
        for key, value in metadata.items():
            if key in METADATA_KEYS and isinstance(value, (str, int, float, bool, type(None))):
                safe[key] = value[:1000] if isinstance(value, str) else value
        now = await self._now()
        row.last_sequence += 1
        row.updated_at = now
        event = RoadmapJobEvent(
            job_id=row.id,
            sequence=row.last_sequence,
            stage=stage or row.stage,
            type=event_type,
            summary=summary,
            details=safe,
            created_at=now,
        )
        self.session.add(event)
        await self.session.flush()
        logger.info(
            "roadmap_job_event",
            job_id=row.id,
            stage=event.stage,
            type=event_type,
            sequence=event.sequence,
        )
        return self._event_data(event)

    async def append_event(
        self, job_id: str, event_type: str, summary: str, metadata: dict[str, JsonValue]
    ) -> JobEventData:
        return await self._event(await self._row(job_id), event_type, summary, metadata)
