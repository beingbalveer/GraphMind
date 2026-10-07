from typing import Annotated

from database import get_db
from dependencies import get_roadmap_user, require_roadmap_read
from errors import RoadmapHTTPError
from fastapi import APIRouter, Depends
from models.user import User
from models.workspace import Workspace
from schemas.curriculum import CurriculumView, TopicBrief
from schemas.roadmap_job import JobError
from services.roadmap.curriculum_repository import CurriculumRepository
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/roadmap", tags=["Learning curriculum"])
DB = Annotated[AsyncSession, Depends(get_db, scope="function")]
Actor = Annotated[User, Depends(get_roadmap_user)]
Access = Annotated[Workspace, Depends(require_roadmap_read)]


def not_found(code: str) -> RoadmapHTTPError:
    return RoadmapHTTPError(
        404,
        JobError(
            code=code,
            message="Roadmap or topic not found",
            recoverable=False,
            next_action="new_run",
        ),
    )


@router.get("", response_model=CurriculumView)
async def read_curriculum(workspace_id: str, db: DB, user: Actor, access: Access) -> CurriculumView:
    view = await CurriculumRepository(db, user.id).read(workspace_id)
    if view is None:
        raise not_found("ROADMAP_NOT_FOUND")
    return view


@router.get("/topics/{topic_id}", response_model=TopicBrief)
async def read_brief(
    workspace_id: str, topic_id: str, db: DB, user: Actor, access: Access
) -> TopicBrief:
    try:
        return await CurriculumRepository(db, user.id).read_brief(workspace_id, topic_id)
    except ValueError as error:
        if str(error) in {"ROADMAP_NOT_FOUND", "TOPIC_NOT_FOUND"}:
            raise not_found(str(error)) from None
        raise
