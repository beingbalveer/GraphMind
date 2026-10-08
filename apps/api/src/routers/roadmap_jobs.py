import asyncio
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated
from uuid import UUID

from config import get_settings
from database import get_db, get_session_factory
from dependencies import get_roadmap_user
from errors import RoadmapHTTPError
from fastapi import APIRouter, Depends, Header, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from models.user import User
from pydantic import Field, ValidationError
from schemas.curriculum import CurriculumSchema, RoadmapRequest
from schemas.roadmap_job import JobError, JobReferenceData, JobSnapshot, PublicJobSnapshot
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.references import ReferenceError, ReferenceService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/roadmap/jobs", tags=["Roadmap jobs"])
Session = Annotated[AsyncSession, Depends(get_db, scope="function")]
Actor = Annotated[User, Depends(get_roadmap_user)]


class LinkInput(CurriculumSchema):
    url: str = Field(min_length=1, max_length=2048)


class AnswerInput(CurriculumSchema):
    question_id: str = Field(min_length=1, max_length=64)
    answer: str = Field(min_length=1, max_length=4000)


def public_job(job: JobSnapshot) -> PublicJobSnapshot:
    summaries = {
        "queued": "Ready for the roadmap agent",
        "running": "Building your learning path",
        "awaiting_input": "One learning preference needs your answer",
        "cancel_requested": "Stopping safely",
        "canceled": "Generation canceled",
        "failed": "Generation needs attention",
        "completed": "Your roadmap is ready",
    }
    return PublicJobSnapshot(
        **job.model_dump(
            exclude={"request", "owner_id", "checkpoint", "usage", "limits", "base_revision_id"}
        ),
        target_workspace_id=job.checkpoint.workspace_id if job.operation == "refine" else None,
        title=job.request.title,
        summary=summaries[job.status],
    )


def http_error(error: JobStateError | ReferenceError) -> RoadmapHTTPError:
    code = error.code
    status = (
        404
        if code in {"JOB_NOT_FOUND", "REFERENCE_NOT_FOUND", "ROADMAP_NOT_FOUND", "TOPIC_NOT_FOUND"}
        else 409
        if code
        in {
            "ACTIVE_JOB_EXISTS",
            "IDEMPOTENCY_MISMATCH",
            "JOB_ALREADY_STARTED",
            "JOB_STATE_INVALID",
            "QUESTION_MISMATCH",
            "STALE_LEASE",
            "BUDGET_EXHAUSTED",
            "REFERENCES_LOCKED",
            "INVALID_JOB_STATE",
        }
        else 422
    )
    detail = (
        error.error
        if isinstance(error, JobStateError)
        else JobError(code=code, message=str(error)[:500], recoverable=False, next_action="new_run")
    )
    return RoadmapHTTPError(status, detail)


async def roadmap_db(db: Session) -> AsyncIterator[AsyncSession]:
    try:
        yield db
    except (JobStateError, ReferenceError) as error:
        raise http_error(error) from None


DB = Annotated[AsyncSession, Depends(roadmap_db, scope="function")]


@router.post("", response_model=PublicJobSnapshot, status_code=202)
async def create_job(
    data: RoadmapRequest, db: DB, user: Actor, idempotency_key: Annotated[UUID, Header()]
) -> PublicJobSnapshot:
    return public_job(await JobRepository(db).create(user.id, data, str(idempotency_key)))


@router.get("", response_model=list[PublicJobSnapshot])
async def list_jobs(db: DB, user: Actor) -> list[PublicJobSnapshot]:
    return [public_job(job) for job in await JobRepository(db).list_for_owner(user.id)]


@router.get("/{job_id}", response_model=PublicJobSnapshot)
async def read_job(job_id: str, db: DB, user: Actor) -> PublicJobSnapshot:
    return public_job(await JobRepository(db).read(job_id, user.id))


@router.post("/{job_id}/start", response_model=PublicJobSnapshot)
async def start_job(job_id: str, db: DB, user: Actor) -> PublicJobSnapshot:
    return public_job(await JobRepository(db).start(job_id, user.id))


@router.post("/{job_id}/cancel", response_model=PublicJobSnapshot)
async def cancel_job(job_id: str, db: DB, user: Actor) -> PublicJobSnapshot:
    return public_job(await JobRepository(db).cancel(job_id, user.id))


@router.post("/{job_id}/retry", response_model=PublicJobSnapshot)
async def retry_job(job_id: str, db: DB, user: Actor) -> PublicJobSnapshot:
    return public_job(await JobRepository(db).retry(job_id, user.id))


@router.post("/{job_id}/answers", response_model=PublicJobSnapshot)
async def answer_job(job_id: str, data: AnswerInput, db: DB, user: Actor) -> PublicJobSnapshot:
    return public_job(
        await JobRepository(db).answer(job_id, user.id, data.question_id, data.answer)
    )


def references(db: AsyncSession) -> ReferenceService:
    return ReferenceService(db, Path(get_settings().ROADMAP_REFERENCE_DIR))


@router.get("/{job_id}/references", response_model=list[JobReferenceData])
async def list_references(job_id: str, db: DB, user: Actor) -> list[JobReferenceData]:
    return await references(db).list_for_job(job_id, user.id)


@router.post("/{job_id}/references", response_model=JobReferenceData, status_code=201)
async def attach_reference(job_id: str, request: Request, db: DB, user: Actor) -> JobReferenceData:
    await JobRepository(db).read(job_id, user.id)  # Ownership before reading upload bytes.
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type == "application/json":
        try:
            link = LinkInput.model_validate(await request.json())
        except (ValidationError, ValueError):
            raise RoadmapHTTPError(
                422,
                JobError(
                    code="REFERENCE_INVALID",
                    message="Provide one public reference URL.",
                    recoverable=False,
                    next_action="new_run",
                ),
            ) from None
        return await references(db).attach_link(job_id, user.id, link.url)
    if content_type == "multipart/form-data":
        async with request.form(max_files=1, max_fields=0, max_part_size=20 * 1024 * 1024) as form:
            file = form.get("file")
            # Starlette's parser returns its base UploadFile, rather than FastAPI's subclass.
            from starlette.datastructures import UploadFile as ParsedUpload

            if not isinstance(file, (UploadFile, ParsedUpload)):
                raise ReferenceError("REFERENCE_INVALID", "Choose a PDF, TXT or Markdown file")
            data = await file.read(20 * 1024 * 1024 + 1)
            return await references(db).attach_file(
                job_id,
                user.id,
                file.filename or "reference",
                file.content_type or "application/octet-stream",
                data,
            )
    raise ReferenceError("REFERENCE_INVALID", "Use a file upload or JSON reference link")


async def job_events(
    job_id: str, owner_id: str, after: int, request: Request | None = None
) -> AsyncIterator[str]:
    heartbeat = time.monotonic()
    while True:
        if request is not None and await request.is_disconnected():
            return
        async with get_session_factory()() as session:
            if request is not None:
                actor = await get_roadmap_user(request, session)
                if actor.id != owner_id:
                    return
            repo = JobRepository(session)
            snapshot = await repo.read(job_id, owner_id)
            events = await repo.events(job_id, owner_id, after)
        # Session closed before yielding: a disconnected browser never retains DB locks.
        for event in events:
            name = {"awaiting_input": "question", "completed": "completed", "failed": "failed"}.get(
                event.type,
                "activity"
                if event.type.startswith("tool_")
                or event.type in {"repair_started", "extraction_limit"}
                else "job",
            )
            yield f"id: {event.sequence}\nevent: {name}\ndata: {event.model_dump_json(by_alias=True)}\n\n"
            after = event.sequence
        if snapshot.status in {"completed", "failed", "canceled"}:
            if after >= snapshot.last_sequence or not events:
                return
            continue  # Drain all persisted batches before closing a terminal stream.
        if events and after < snapshot.last_sequence:
            continue
        if time.monotonic() - heartbeat >= 15:
            yield ": heartbeat\n\n"
            heartbeat = time.monotonic()
        await asyncio.sleep(1)


@router.get("/{job_id}/events")
async def stream_events(
    job_id: str,
    request: Request,
    db: DB,
    user: Actor,
    after: Annotated[int, Query(ge=0, le=2147483647)] = 0,
    last_event_id: Annotated[str | None, Header()] = None,
) -> StreamingResponse:
    await JobRepository(db).read(job_id, user.id)
    try:
        supplied = int(last_event_id or "0")
        cursor = max(after, supplied if 0 <= supplied <= 2147483647 else 0)
    except ValueError:
        cursor = after
    return StreamingResponse(
        job_events(job_id, user.id, cursor, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
