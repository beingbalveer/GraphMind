from typing import Optional

from database import get_db
from dependencies import get_optional_user
from fastapi import APIRouter, Depends, status
from models.user import User
from schemas.roadmap import RoadmapGenerateRequest, RoadmapGenerateResponse
from services.roadmap_service import RoadmapService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/roadmap", tags=["Roadmap Generator"])


@router.post(
    "/generate",
    response_model=RoadmapGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AI learning roadmap as a structured graph workspace",
)
async def generate_roadmap(
    data: RoadmapGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> RoadmapGenerateResponse:
    """
    Synthesize an AI learning roadmap for a goal, level, and focus area.
    Creates a new persistent workspace populated with structured topic nodes,
    prerequisite edges, and knowledge concepts.
    """
    owner_id = current_user.id if current_user else "usr_default_admin"
    return await RoadmapService.generate_roadmap(db, data, owner_id=owner_id)
