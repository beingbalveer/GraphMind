from database import get_db
from dependencies import require_workspace_read, require_workspace_write
from fastapi import APIRouter, Depends
from models.workspace import Workspace
from schemas.canvas import CanvasLayoutResponse, CanvasLayoutWrite, GraphKind
from services.canvas_service import read_layout, write_layout
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/chats/{chat_id}/canvas-layout", tags=["canvas"])


@router.get("", response_model=CanvasLayoutResponse)
async def get_canvas_layout(
    workspace_id: str, chat_id: str, kind: GraphKind = "conversation",
    db: AsyncSession = Depends(get_db),
    workspace: Workspace = Depends(require_workspace_read),
) -> CanvasLayoutResponse:
    return await read_layout(db, workspace_id, chat_id, kind)


@router.put("", response_model=CanvasLayoutResponse)
async def put_canvas_layout(
    workspace_id: str, chat_id: str, request: CanvasLayoutWrite,
    kind: GraphKind = "conversation", db: AsyncSession = Depends(get_db),
    workspace: Workspace = Depends(require_workspace_write),
) -> CanvasLayoutResponse:
    return await write_layout(db, workspace_id, chat_id, kind, request)
