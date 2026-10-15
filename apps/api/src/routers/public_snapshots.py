"""Anonymous public snapshot and lesson reads (LSI-027).

Read-only, unauthenticated routes over the immutable published snapshot catalog
frozen by :mod:`services.roadmap.public_snapshots` (LSI-025). This is the
snapshot/lesson half of the LSI-002 §3 public boundary; the catalog *list*
(search/category/level/pagination) is LSI-026 and lives in its own router.

Guarantees enforced here:

* Only ``status = 'published'`` snapshots are ever served. Missing, unknown,
  stale (superseded) and unpublished content all collapse to one uniform,
  neutral ``404`` so a caller cannot tell "never existed" from "withdrawn".
* Versioned reads: an optional ``version`` query pins a frozen
  ``snapshot_version``; when omitted the newest published version of the
  template (keyed by the stable ``slug``) is resolved deterministically.
* Public payloads are built by the LSI-025 DTO builders from vetted fields
  only, so no private workspace/roadmap/revision/chat/user identity can appear.
* Source references are additionally defended in depth: any non-``http(s)``
  location (for example a ``javascript:`` or ``data:`` URI) is stripped to
  ``None`` rather than forwarded to a guest browser.
* Responses are ``no-store``: availability can change via unpublish, so a
  published body must never be cached and replayed after withdrawal.
"""

from typing import Annotated
from urllib.parse import urlsplit

import structlog
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Response, status
from schemas.public import PublicLessonDetail, PublicRoadmapDetail, PublicSourceReference
from services.roadmap.public_snapshots import PublicSnapshotService
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

router = APIRouter(prefix="/public", tags=["Public learning"])

DB = Annotated[AsyncSession, Depends(get_db, scope="function")]

# One neutral string for every unavailable case, so an anonymous caller learns
# nothing about whether a template was never published or has been withdrawn.
UNAVAILABLE_MESSAGE = "This content is not available."

_SAFE_URL_SCHEMES = frozenset({"http", "https"})


def _unavailable(reason: str, path: str) -> HTTPException:
    """Build the uniform, private-data-free unavailable response."""
    logger.info("public_content_unavailable", reason=reason, path=path)
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=UNAVAILABLE_MESSAGE)


def _is_safe_source_url(url: str | None) -> bool:
    if url is None:
        return True
    parsed = urlsplit(url)
    return parsed.scheme in _SAFE_URL_SCHEMES and bool(parsed.netloc)


def _safe_source(source: PublicSourceReference) -> PublicSourceReference:
    if _is_safe_source_url(source.url):
        return source
    return source.model_copy(update={"url": None})


def _safe_sources(sources: list[PublicSourceReference]) -> list[PublicSourceReference]:
    return [_safe_source(source) for source in sources]


@router.get(
    "/roadmaps/{slug}",
    response_model=PublicRoadmapDetail,
    summary="Read a published public roadmap snapshot",
)
async def read_public_roadmap(
    slug: str,
    response: Response,
    db: DB,
    version: str | None = None,
) -> PublicRoadmapDetail:
    """Return the newest (or a pinned) published version of a public template.

    A guest with no credentials receives exactly the same frozen snapshot as a
    signed-in learner; private identity never crosses this boundary.
    """
    response.headers["Cache-Control"] = "no-store"
    service = PublicSnapshotService(db)
    detail = await service.read_roadmap(slug=slug, snapshot_version=version)
    if detail is None:
        raise _unavailable("roadmap", f"/public/roadmaps/{slug}")
    return detail.model_copy(update={"sources": _safe_sources(detail.sources)})


@router.get(
    "/roadmaps/{slug}/topics/{topic_slug}",
    response_model=PublicLessonDetail,
    summary="Read a published public lesson body",
)
async def read_public_lesson(
    slug: str,
    topic_slug: str,
    response: Response,
    db: DB,
    version: str | None = None,
) -> PublicLessonDetail:
    """Return an authored lesson from the newest (or a pinned) published version.

    ``topic_slug`` resolves against the frozen public topic slug or its stable
    opaque public ID, so list and canvas views can deep-link to the same lesson.
    """
    response.headers["Cache-Control"] = "no-store"
    service = PublicSnapshotService(db)
    detail = await service.read_roadmap(slug=slug, snapshot_version=version)
    if detail is None:
        raise _unavailable("lesson_snapshot", f"/public/roadmaps/{slug}")
    lesson = await service.read_lesson(
        template_id=detail.id,
        snapshot_version=detail.snapshot_version,
        topic_ref=topic_slug,
    )
    if lesson is None:
        raise _unavailable("lesson_topic", f"/public/roadmaps/{slug}/topics/{topic_slug}")
    return lesson.model_copy(update={"sources": _safe_sources(lesson.sources)})
