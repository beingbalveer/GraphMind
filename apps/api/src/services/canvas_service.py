import structlog
from fastapi import HTTPException
from models.canvas import CanvasLayoutModel, utc_now
from models.workspace import NodeModel
from schemas.canvas import (
    CanvasLayout,
    CanvasLayoutResponse,
    CanvasLayoutWrite,
    CanvasViewport,
    GraphKind,
)
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Executable

logger = structlog.get_logger()


async def require_chat_root(db: AsyncSession, workspace_id: str, chat_id: str) -> None:
    root = await db.scalar(
        select(NodeModel.id).where(
            NodeModel.id == chat_id,
            NodeModel.workspace_id == workspace_id,
            NodeModel.parent_id.is_(None),
        )
    )
    if root is None:
        raise HTTPException(404, "Chat not found in this workspace")


async def read_layout(
    db: AsyncSession,
    workspace_id: str,
    chat_id: str,
    kind: GraphKind,
) -> CanvasLayoutResponse:
    await require_chat_root(db, workspace_id, chat_id)
    model = await db.get(CanvasLayoutModel, (workspace_id, chat_id, kind))
    if model is None:
        return CanvasLayoutResponse(layout=None, revision=0)
    return CanvasLayoutResponse(
        layout=CanvasLayout(
            version=model.layout_version,
            positions=model.positions,
            viewport=CanvasViewport.model_validate(model.viewport) if model.viewport else None,
            topology_key=model.topology_key,
        ),
        revision=model.revision,
    )


async def write_layout(
    db: AsyncSession,
    workspace_id: str,
    chat_id: str,
    kind: GraphKind,
    request: CanvasLayoutWrite,
) -> CanvasLayoutResponse:
    await require_chat_root(db, workspace_id, chat_id)
    layout = request.layout
    values = {
        "layout_version": layout.version,
        "positions": {key: point.model_dump() for key, point in layout.positions.items()},
        "viewport": layout.viewport.model_dump() if layout.viewport else None,
        "topology_key": layout.topology_key,
        "revision": request.base_revision + 1,
        "updated_at": utc_now(),
    }
    stmt: Executable
    if request.base_revision == 0:
        stmt = (
            insert(CanvasLayoutModel)
            .values(
                workspace_id=workspace_id,
                chat_id=chat_id,
                graph_kind=kind,
                **values,
            )
            .on_conflict_do_nothing()
            .returning(CanvasLayoutModel.revision)
        )
    else:
        stmt = (
            update(CanvasLayoutModel)
            .where(
                CanvasLayoutModel.workspace_id == workspace_id,
                CanvasLayoutModel.chat_id == chat_id,
                CanvasLayoutModel.graph_kind == kind,
                CanvasLayoutModel.revision == request.base_revision,
            )
            .values(**values)
            .returning(CanvasLayoutModel.revision)
        )
    revision = (await db.execute(stmt)).scalar_one_or_none()
    if revision is None:
        logger.info("Canvas layout conflict", workspace_id=workspace_id, chat_id=chat_id, kind=kind)
        raise HTTPException(409, "Canvas layout changed; reload before saving")
    logger.info(
        "Canvas layout saved",
        workspace_id=workspace_id,
        chat_id=chat_id,
        kind=kind,
        revision=revision,
    )
    return CanvasLayoutResponse(layout=layout, revision=revision)
