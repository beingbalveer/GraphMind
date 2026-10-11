"""REST endpoints for importing curated roadmap.sh curricula (no AI involved)."""

from typing import Annotated

from database import get_db
from dependencies import get_roadmap_user
from fastapi import APIRouter, Depends, status
from models.user import User
from schemas.roadmap_import import (
    RoadmapImportError,
    RoadmapImportField,
    RoadmapImportRequest,
    RoadmapImportResponse,
    RoadmapImportResultItem,
)
from services.roadmap.import_service import CURATED_FIELDS, CURATED_TOPIC_COUNTS, import_roadmaps
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/roadmap/imports", tags=["Roadmap imports"])
Session = Annotated[AsyncSession, Depends(get_db, scope="function")]
Actor = Annotated[User, Depends(get_roadmap_user)]


@router.get("/fields", response_model=list[RoadmapImportField])
async def list_import_fields(user: Actor) -> list[RoadmapImportField]:
    """List the curated roadmap.sh fields available for import."""
    return [
        RoadmapImportField(
            slug=slug,
            title=meta["title"],
            url=meta["url"],
            topic_count=CURATED_TOPIC_COUNTS.get(slug, 0),
        )
        for slug, meta in CURATED_FIELDS.items()
    ]


@router.post("", response_model=RoadmapImportResponse, status_code=status.HTTP_201_CREATED)
async def create_imports(
    data: RoadmapImportRequest,
    db: Session,
    user: Actor,
) -> RoadmapImportResponse:
    """Import selected roadmap.sh fields; each becomes a fresh workspace + active roadmap."""
    results, errors = await import_roadmaps(db, owner_id=user.id, slugs=data.slugs)
    return RoadmapImportResponse(
        results=[RoadmapImportResultItem(**item) for item in results],
        errors=[RoadmapImportError(**item) for item in errors],
    )
