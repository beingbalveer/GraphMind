"""Anonymous public catalog API (LSI-026).

Exposes the approved guest catalog contract from LSI-002 §3.1: a searchable,
category/level-filtered, paginated list of published learning roadmaps.

Requirements enforced here:

* **Anonymous.** No authentication token and no workspace header are required;
  any caller (guest or signed-in) sees the same published catalog. This router
  depends only on the request-scoped database session.
* **Published only.** :class:`PublicSnapshotService` filters
  ``status = 'published'`` for every query; unpublished snapshots never appear.
* **Bounded.** ``limit`` (1–100) and ``offset`` (≥ 0) are validated by FastAPI,
  and free-text filters are length-bounded, so no unbounded page can be
  requested. Invalid filters fail with the repository's structured
  ``VALIDATION_ERROR`` payload.
* **No private metadata.** The response is the frozen ``PublicRoadmapSummaryList``
  DTO; private workspace/roadmap/revision/user identity is never projected.
"""

from database import get_db
from fastapi import APIRouter, Depends, Query, status
from schemas.public import PublicLevel, PublicRoadmapSummaryList
from services.roadmap.public_snapshots import PublicSnapshotService
from sqlalchemy.ext.asyncio import AsyncSession

CATALOG_DEFAULT_LIMIT = 20
CATALOG_MAX_LIMIT = 100
CATALOG_MAX_QUERY_LENGTH = 200
CATALOG_MAX_CATEGORY_LENGTH = 64

router = APIRouter(prefix="/public/roadmaps", tags=["Public Catalog"])


@router.get(
    "",
    response_model=PublicRoadmapSummaryList,
    status_code=status.HTTP_200_OK,
    summary="Browse the anonymous public roadmap catalog",
)
async def list_public_roadmaps(
    query: str | None = Query(
        default=None,
        max_length=CATALOG_MAX_QUERY_LENGTH,
        description="Optional case-insensitive search over roadmap title and summary",
    ),
    category: str | None = Query(
        default=None,
        min_length=1,
        max_length=CATALOG_MAX_CATEGORY_LENGTH,
        description="Optional exact category filter (e.g. 'backend')",
    ),
    level: PublicLevel | None = Query(default=None, description="Optional level filter"),
    limit: int = Query(
        default=CATALOG_DEFAULT_LIMIT,
        ge=1,
        le=CATALOG_MAX_LIMIT,
        description="Page size (1–100)",
    ),
    offset: int = Query(default=0, ge=0, description="Number of templates to skip"),
    db: AsyncSession = Depends(get_db),
) -> PublicRoadmapSummaryList:
    """List published roadmap templates for anonymous discovery.

    Returns one card per published template (its newest published version).
    Empty results are deterministic: ``items`` is empty and ``total`` is ``0``
    while the requested ``limit``/``offset`` are echoed back unchanged.
    """
    service = PublicSnapshotService(db)
    return await service.list_catalog(
        query=query,
        category=category,
        level=level,
        limit=limit,
        offset=offset,
    )
