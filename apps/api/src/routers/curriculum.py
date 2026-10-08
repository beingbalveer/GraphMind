from typing import Annotated, Literal
from uuid import UUID

from database import get_db
from dependencies import get_roadmap_user, require_roadmap_read, require_roadmap_write
from errors import RoadmapHTTPError
from fastapi import APIRouter, Depends, Header, HTTPException
from models.user import User
from models.workspace import Workspace
from schemas.curriculum import (
    CurriculumSchema,
    CurriculumView,
    KnowledgeCheckData,
    TopicBrief,
    TopicProgressData,
    TopicSessionData,
)
from schemas.roadmap_job import JobError
from services.roadmap.curriculum_repository import CurriculumRepository
from services.roadmap.progress import ProgressService
from services.roadmap.tutor import TutorService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/roadmap", tags=["Learning curriculum"])
DB = Annotated[AsyncSession, Depends(get_db, scope="function")]
Actor = Annotated[User, Depends(get_roadmap_user)]
Access = Annotated[Workspace, Depends(require_roadmap_read)]
WriteAccess = Annotated[Workspace, Depends(require_roadmap_write)]


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


class SessionRequest(CurriculumSchema):
    fresh: bool = False


class ProgressRequest(CurriculumSchema):
    status: Literal["not_started", "in_progress", "completed"]


class CheckRequest(CurriculumSchema):
    session_id: str


@router.post("/topics/{topic_id}/sessions", response_model=TopicSessionData, status_code=201)
async def open_topic_session(
    workspace_id: str,
    topic_id: str,
    body: SessionRequest,
    db: DB,
    user: Actor,
    access: WriteAccess,
    idempotency_key: Annotated[UUID, Header(alias="Idempotency-Key")],
) -> TopicSessionData:
    return await TutorService(db).open_session(
        workspace_id, topic_id, user.id, str(idempotency_key), body.fresh
    )


@router.get("/sessions/{session_id}", response_model=TopicSessionData)
async def read_topic_session(
    workspace_id: str, session_id: str, db: DB, user: Actor, access: Access
) -> TopicSessionData:
    service = TutorService(db)
    _, roadmap = await service.read_session(session_id, user.id)
    if roadmap.workspace_id != workspace_id:
        raise HTTPException(404, "Topic session not found")
    return await service.session_data(session_id, user.id)


@router.patch("/topics/{topic_id}/progress", response_model=TopicProgressData)
async def update_topic_progress(
    workspace_id: str,
    topic_id: str,
    body: ProgressRequest,
    db: DB,
    user: Actor,
    access: WriteAccess,
) -> TopicProgressData:
    return await ProgressService(db).set_status(workspace_id, topic_id, user.id, body.status)


@router.post("/topics/{topic_id}/checks", response_model=KnowledgeCheckData, status_code=201)
async def check_topic(
    workspace_id: str, topic_id: str, body: CheckRequest, db: DB, user: Actor, access: WriteAccess
) -> KnowledgeCheckData:
    service = ProgressService(db)
    prepared = await service.prepare_check(workspace_id, topic_id, user.id, body.session_id)
    # Snapshot DB-owned evidence and release the transaction before external inference.
    await db.commit()
    return await service.record_check(
        workspace_id, topic_id, user.id, body.session_id, prepared=prepared
    )
