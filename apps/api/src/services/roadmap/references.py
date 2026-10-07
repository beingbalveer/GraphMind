"""Private, job-scoped material. Text is evidence and never an instruction source."""

import hashlib
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

import anyio
import structlog
from models.roadmap import new_id
from models.roadmap_job import RoadmapJob, RoadmapJobReference
from schemas.roadmap_job import JobError, JobReferenceData, ReferenceSection
from services.file_service import extract_reference_text
from services.roadmap.job_repository import JobRepository, JobStateError
from services.roadmap.source_fetcher import SourceFetchError, canonical_source_url
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()
FILE_MIMES = {
    ".pdf": {"application/pdf"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".md": {"text/plain", "text/markdown", "text/x-markdown", "application/octet-stream"},
}


class ReferenceError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


def display_name(filename: str) -> str:
    name = filename.replace("\\", "/").split("/")[-1].strip()
    return re.sub(r"[^\w. ()-]", "_", name)[:255] or "reference.txt"


def write_private_file(path: Path, data: bytes) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as file:
        file.write(data)
        file.flush()
        os.fsync(file.fileno())


def orphan_paths(directory: Path, known: set[Path], cutoff: float) -> list[Path]:
    if not directory.is_dir():
        return []
    return [
        path
        for path in directory.glob("*.bin")
        if path.resolve() not in known and path.stat().st_mtime < cutoff
    ]


class ReferenceService:
    def __init__(self, session: AsyncSession, storage_dir: Path) -> None:
        self.session = session
        self.storage_dir = storage_dir.resolve()
        self.jobs = JobRepository(session)

    async def _job(self, job_id: str, owner_id: str, *, attach: bool = False) -> RoadmapJob:
        try:
            job = await self.jobs._row(job_id, owner_id)
        except JobStateError:
            raise ReferenceError("JOB_NOT_FOUND", "Roadmap job not found") from None
        if attach and (job.startup_ready or job.status != "queued"):
            raise ReferenceError(
                "REFERENCES_FINALIZED", "Start a new run to change finalized references"
            )
        return job

    def _public(self, row: RoadmapJobReference) -> JobReferenceData:
        return JobReferenceData.model_validate(
            {
                "id": row.id,
                "kind": row.kind,
                "name": row.name,
                "status": row.status,
                "size_bytes": row.size_bytes,
                "error": row.error,
                "locator": row.url if row.kind == "link" else None,
            }
        )

    async def _rows(self, job_id: str) -> list[RoadmapJobReference]:
        return list(
            (
                await self.session.scalars(
                    select(RoadmapJobReference)
                    .where(RoadmapJobReference.job_id == job_id)
                    .order_by(RoadmapJobReference.created_at, RoadmapJobReference.id)
                )
            ).all()
        )

    async def attach_file(
        self, job_id: str, owner_id: str, filename: str, content_type: str, data: bytes
    ) -> JobReferenceData:
        await self._job(job_id, owner_id, attach=True)
        name = display_name(filename)
        mime = content_type.split(";")[0].lower().strip()
        extension = Path(name).suffix.lower()
        if mime not in FILE_MIMES.get(extension, set()):
            raise ReferenceError("UNSUPPORTED_FILE", "Upload a text PDF, TXT or Markdown file")
        if len(data) > 20 * 1024 * 1024:
            raise ReferenceError("FILE_SIZE_LIMIT", "Each file must be 20MB or smaller")
        digest = hashlib.sha256(data).hexdigest()
        key = hashlib.sha256(f"file:{digest}:{name}".encode()).hexdigest()
        rows = await self._rows(job_id)
        for row in rows:
            if row.dedup_key == key:
                return self._public(row)
        files = [row for row in rows if row.kind == "file"]
        if len(files) >= 5:
            raise ReferenceError("FILE_COUNT_LIMIT", "Add at most five files")
        if sum(row.size_bytes for row in files) + len(data) > 50 * 1024 * 1024:
            raise ReferenceError("TOTAL_SIZE_LIMIT", "Keep all files together within 50MB")
        extracted = await anyio.to_thread.run_sync(
            extract_reference_text, data, "application/pdf" if extension == ".pdf" else "text/plain"
        )
        reference_id = new_id("ref")
        directory = self.storage_dir / job_id
        path = directory / f"{reference_id}.bin"
        await anyio.to_thread.run_sync(write_private_file, path, data)
        warning = (
            "Extraction limit reached; only the first 2MB of readable text is available."
            if extracted.limited
            else None
        )
        row = RoadmapJobReference(
            id=reference_id,
            job_id=job_id,
            kind="file",
            name=name,
            dedup_key=key,
            status="rejected" if extracted.error else "inspected",
            size_bytes=len(data),
            content_type=mime,
            storage_path=str(path),
            error=extracted.error or warning,
            sections=[
                ReferenceSection(reference_id=reference_id, locator=locator, text=text).model_dump(
                    mode="json"
                )
                for locator, text in extracted.sections
            ],
        )
        self.session.add(row)
        await self.session.flush()
        if extracted.limited or extracted.error:
            await self.jobs.append_event(
                job_id,
                "extraction_limit" if extracted.limited else "reference_rejected",
                "A reference reached its extraction limit"
                if extracted.limited
                else "A reference has no readable text",
                {"referenceId": reference_id},
            )
        return self._public(row)

    async def attach_link(self, job_id: str, owner_id: str, url: str) -> JobReferenceData:
        await self._job(job_id, owner_id, attach=True)
        try:
            canonical = canonical_source_url(url)
        except SourceFetchError as error:
            raise ReferenceError(error.code, str(error)) from None
        if len(canonical) > 2048:
            raise ReferenceError("URL_BLOCKED", "Keep source URLs within 2048 characters")
        key = hashlib.sha256(f"link:{canonical}".encode()).hexdigest()
        rows = await self._rows(job_id)
        for row in rows:
            if row.dedup_key == key:
                return self._public(row)
        if sum(row.kind == "link" for row in rows) >= 10:
            raise ReferenceError("LINK_COUNT_LIMIT", "Add at most ten links")
        row = RoadmapJobReference(
            job_id=job_id,
            kind="link",
            name=canonical[:255],
            dedup_key=key,
            status="staged",
            size_bytes=0,
            url=canonical,
            sections=[],
        )
        self.session.add(row)
        await self.session.flush()
        return self._public(row)

    async def read(self, job_id: str, owner_id: str, reference_id: str) -> list[ReferenceSection]:
        await self._job(job_id, owner_id)
        row = await self.session.scalar(
            select(RoadmapJobReference).where(
                RoadmapJobReference.id == reference_id, RoadmapJobReference.job_id == job_id
            )
        )
        if row is None:
            raise ReferenceError("REFERENCE_NOT_FOUND", "Reference not found")
        return [ReferenceSection.model_validate(section) for section in row.sections]

    async def list_for_job(self, job_id: str, owner_id: str) -> list[JobReferenceData]:
        await self._job(job_id, owner_id)
        return [self._public(row) for row in await self._rows(job_id)]

    async def expire(self, now: datetime) -> int:
        """Delete orphan rows now; unlink storage only after the caller commits."""
        jobs = (
            await self.session.scalars(
                select(RoadmapJob)
                .where(
                    (
                        (RoadmapJob.startup_ready.is_(False))
                        & (RoadmapJob.created_at < now - timedelta(hours=24))
                    )
                    | (
                        (RoadmapJob.status.in_(("failed", "canceled")))
                        & (RoadmapJob.updated_at < now - timedelta(days=7))
                    )
                )
                .with_for_update(skip_locked=True)
            )
        ).all()
        paths: list[Path] = []
        count = 0
        for job in jobs:
            job_expired = 0
            rows = (
                await self.session.scalars(
                    select(RoadmapJobReference)
                    .where(RoadmapJobReference.job_id == job.id)
                    .with_for_update()
                )
            ).all()
            known: set[Path] = set()
            for row in rows:
                path = (
                    Path(await anyio.Path(row.storage_path).resolve()) if row.storage_path else None
                )
                if path is not None:
                    known.add(path)
                if row.workspace_id is not None:
                    continue
                if path is not None:
                    if path.is_relative_to(self.storage_dir):
                        paths.append(path)
                await self.session.delete(row)
                count += 1
                job_expired += 1
            # An abandoned setup can no longer start after its references expire.
            if not job.startup_ready and job.status == "queued":
                job.status = "canceled"
            if job_expired:
                job.status = "failed"
                job.error = JobError(
                    code="REFERENCES_EXPIRED",
                    message="The staged references expired. Start a new run.",
                    recoverable=False,
                    next_action="new_run",
                ).model_dump(mode="json")
                await self.jobs._event(job, "references_expired", "Unpublished references expired", {})
            directory = self.storage_dir / job.id
            paths.extend(
                await anyio.to_thread.run_sync(
                    orphan_paths, directory, known, (now - timedelta(hours=24)).timestamp()
                )
            )
        await self.session.flush()
        if paths:
            canceled = False

            def rollback(session: object) -> None:
                nonlocal canceled
                canceled = True

            def after_commit(session: object) -> None:
                if canceled:
                    return
                for path in paths:
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        logger.warning("reference_cleanup_unlink_failed", path=str(path))

            event.listen(self.session.sync_session, "after_commit", after_commit, once=True)
            event.listen(self.session.sync_session, "after_rollback", rollback, once=True)
        return count
