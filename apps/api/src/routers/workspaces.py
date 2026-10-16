from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from database import get_db
from dependencies import (
    get_current_user,
    get_roadmap_user,
    require_roadmap_read,
    require_roadmap_write,
    require_workspace_read,
    require_workspace_write,
)
from errors import RoadmapHTTPError
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from models.user import User
from models.workspace import Workspace
from schemas.enrollment import EnrollmentDetail, SaveRoadmapCopyRequest
from schemas.export import WorkspaceExportResponse
from schemas.roadmap_job import JobError
from schemas.workspace import (
    ChatListResponse,
    GraphDeltaUpdateRequest,
    GraphSnapshotResponse,
    NodeCreate,
    NodeResponse,
    SemanticSearchRequest,
    WorkspaceCreate,
    WorkspaceCurriculumSummary,
    WorkspaceListResponse,
    WorkspaceResponse,
    WorkspaceSearchResponse,
    WorkspaceUpdate,
)
from services.roadmap.save_copy import SaveCopyError, SaveCopyService
from services.search_service import SearchService
from services.semantic_service import SemanticService
from services.workspace_export_service import WorkspaceExportService
from services.workspace_service import WorkspaceService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces", tags=["Workspaces & Persistence"])


def _save_copy_error(error: SaveCopyError) -> RoadmapHTTPError:
    """Map a structured save-copy failure onto the shared roadmap error body."""
    recoverable = error.code == "SNAPSHOT_NOT_COPYABLE"
    return RoadmapHTTPError(
        error.status,
        JobError(
            code=error.code,
            message=error.message[:500],
            recoverable=recoverable,
            next_action="retry" if recoverable else "new_run",
            detail=error.detail[:100],
        ),
    )


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceListResponse:
    """
    List the workspaces accessible to the authenticated user ordered by last modified.

    Authentication is required: an anonymous caller must never enumerate every
    tenant's workspace metadata.
    """
    workspaces, total = await WorkspaceService.list_workspaces(
        db, limit=limit, offset=offset, user_id=current_user.id
    )
    return WorkspaceListResponse(workspaces=workspaces, total=total)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Create a new workspace owned by the authenticated user.
    """
    return await WorkspaceService.create_workspace(db, data, owner_id=current_user.id)


@router.post("/seed", response_model=Dict[str, str], status_code=status.HTTP_201_CREATED)
async def seed_demo_workspace(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, str]:
    """
    Seeds a full demo workspace for first-time onboarding for the authenticated user.
    Returns the workspaceId and initialChatId.
    """
    from services.seed_service import seed_demo_workspace as seed_svc

    ws_id, chat_id = await seed_svc(db, owner_id=current_user.id)
    return {"workspaceId": ws_id, "initialChatId": chat_id}


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Get workspace metadata by ID (read permission required).
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return ws


@router.get(
    "/{workspace_id}/learning-roadmaps",
    response_model=List[WorkspaceCurriculumSummary],
)
async def get_workspace_learning_roadmaps(
    workspace_id: str,
    _auth_ws: Workspace = Depends(require_roadmap_read),
    current_user: User = Depends(get_roadmap_user),
    db: AsyncSession = Depends(get_db),
) -> List[WorkspaceCurriculumSummary]:
    """
    Get authorized curriculum summaries for a workspace (read permission required).
    """
    return await WorkspaceService.get_workspace_curricula(db, workspace_id, user_id=current_user.id)


@router.post(
    "/{workspace_id}/learning-roadmaps",
    response_model=EnrollmentDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Save a published public roadmap into a workspace",
)
async def save_workspace_learning_roadmap(
    workspace_id: str,
    data: SaveRoadmapCopyRequest,
    response: Response,
    idempotency_key: Annotated[UUID, Header()],
    _auth_ws: Workspace = Depends(require_roadmap_write),
    current_user: User = Depends(get_roadmap_user),
    db: AsyncSession = Depends(get_db),
) -> EnrollmentDetail:
    """Create (or idempotently reuse) a private copy of a published snapshot.

    Write permission required. The ``Idempotency-Key`` header is mandatory. A
    first save returns ``201`` with the new private copy; a retry of the same
    ``(workspace, template)`` returns the existing copy with ``200`` and creates
    no duplicate rows. The whole copy is written in one request transaction, so a
    failure leaves no orphan anchor, roadmap, or copy behind.
    """
    try:
        detail, created = await SaveCopyService(db).save(
            current_user.id, workspace_id, data, str(idempotency_key)
        )
    except SaveCopyError as error:
        raise _save_copy_error(error) from None
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return detail


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Update workspace metadata or viewport position (write permission required).
    """
    ws = await WorkspaceService.update_workspace(db, workspace_id, data)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return ws


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    workspace_id: str,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a workspace and all of its associated nodes and edges (write permission required).
    """
    deleted = await WorkspaceService.delete_workspace(db, workspace_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )


@router.get("/{workspace_id}/chats", response_model=ChatListResponse)
async def list_workspace_chats(
    workspace_id: str,
    _auth_ws: Workspace = Depends(require_workspace_read),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatListResponse:
    """
    List all distinct conversation trees (chats) belonging to a workspace (read permission required).
    """
    chats = await WorkspaceService.list_workspace_chats(
        db, workspace_id, current_user.id if current_user else None
    )
    return ChatListResponse(
        workspace_id=workspace_id,
        chats=chats,
        total=len(chats),
    )


@router.delete("/{workspace_id}/chats/{chat_root_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_tree(
    workspace_id: str,
    chat_root_id: str,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a conversation tree (chat) and all its branched responses from a workspace (write permission required).
    """
    deleted = await WorkspaceService.delete_chat(db, workspace_id, chat_root_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat '{chat_root_id}' not found in workspace '{workspace_id}'",
        )


@router.patch("/{workspace_id}/chats/{chat_root_id}", status_code=status.HTTP_200_OK)
async def update_chat_tree(
    workspace_id: str,
    chat_root_id: str,
    body: Dict[str, Any],
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Update a conversation tree's metadata (title and/or pinned state) on its root node (write permission required).
    Body: { "title"?: string, "pinned"?: boolean }
    """
    title = body.get("title")
    pinned = body.get("pinned") if "pinned" in body else body.get("isPinned")

    if title is None and pinned is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field ('title' or 'pinned') must be provided",
        )

    title_val = title.strip() if isinstance(title, str) else None
    pinned_val = bool(pinned) if pinned is not None else None

    updated = await WorkspaceService.update_chat_metadata(
        db, workspace_id, chat_root_id, title=title_val, pinned=pinned_val
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat '{chat_root_id}' not found in workspace '{workspace_id}'",
        )
    return {"id": chat_root_id, "title": title_val, "pinned": pinned_val}


@router.delete("/{workspace_id}/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    workspace_id: str,
    node_id: str,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a specific node and all its recursive descendants (write permission required).
    """
    deleted = await WorkspaceService.delete_branch(db, workspace_id, node_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found in workspace '{workspace_id}'",
        )


@router.get("/{workspace_id}/graph", response_model=GraphSnapshotResponse)
async def get_graph_snapshot(
    workspace_id: str,
    root_id: Optional[str] = Query(
        default=None, description="Optional root node ID to filter a single chat tree"
    ),
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> GraphSnapshotResponse:
    """
    Retrieve graph topology (nodes, edges, viewport) for a workspace (read permission required).
    """
    snapshot = await WorkspaceService.get_graph_snapshot(db, workspace_id, root_id)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return snapshot


@router.get("/{workspace_id}/export", response_model=WorkspaceExportResponse)
async def export_workspace(
    workspace_id: str,
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceExportResponse:
    """
    Export the caller-owned data of a single workspace as a versioned JSON
    archive (read permission required). The archive never contains provider
    credentials, embeddings, storage paths, or server metadata.
    """
    return await WorkspaceExportService.build_export(db, _auth_ws)


@router.post(
    "/{workspace_id}/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED
)
async def add_node_to_workspace(
    workspace_id: str,
    data: NodeCreate,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    """
    Add a conversation node to a workspace (write permission required).
    """
    return await WorkspaceService.add_node_and_edge(db, workspace_id, data)


@router.patch(
    "/{workspace_id}/nodes/{node_id}", response_model=NodeResponse, status_code=status.HTTP_200_OK
)
async def update_node(
    workspace_id: str,
    node_id: str,
    body: Dict[str, Any],
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    """
    Update a conversation node's metadata or content (write permission required).
    """
    node = await WorkspaceService.update_node(db, workspace_id, node_id, body)
    if not node:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found in workspace '{workspace_id}'",
        )
    return node


@router.post("/{workspace_id}/delta")
async def save_graph_delta(
    workspace_id: str,
    delta: GraphDeltaUpdateRequest,
    _auth_ws: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Apply debounced delta updates (viewport camera changes and moved node coordinates) (write permission required).
    """
    await WorkspaceService.apply_graph_delta(db, workspace_id, delta)
    return {"status": "ok", "workspace_id": workspace_id}


@router.post("/{workspace_id}/search/semantic")
async def search_workspace_semantic(
    workspace_id: str,
    data: SemanticSearchRequest,
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Execute pgvector cosine similarity search across all embedded nodes (read permission required).
    """
    semantic_service = SemanticService()
    matches = await semantic_service.search_workspace_nodes(
        db=db,
        workspace_id=workspace_id,
        query=data.query,
        top_k=data.top_k,
        min_similarity=data.min_similarity,
    )
    return {
        "workspace_id": workspace_id,
        "query": data.query,
        "total_matches": len(matches),
        "results": [m.model_dump() for m in matches],
    }


@router.post("/{workspace_id}/search", response_model=WorkspaceSearchResponse)
async def search_workspace(
    workspace_id: str,
    data: SemanticSearchRequest,
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceSearchResponse:
    """
    Inventory-backed, permission-scoped graph and file search.

    Runs the existing semantic node search and hybrid file retrieval for a
    single authorized workspace and returns both legs together so the client
    can navigate each hit to its canonical context. Read permission required.
    """
    service = SearchService()
    return await service.search(
        db,
        workspace_id=workspace_id,
        query=data.query,
        top_k=data.top_k,
        min_similarity=data.min_similarity,
    )


@router.get("/{workspace_id}/discover/links")
async def discover_cross_branch_links(
    workspace_id: str,
    min_similarity: float = Query(default=0.75, ge=0.0, le=1.0),
    limit: int = Query(default=10, ge=1, le=50),
    _auth_ws: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Discover cross-branch semantic connection opportunities (read permission required).
    """
    semantic_service = SemanticService()
    links = await semantic_service.discover_cross_branch_links(
        db=db,
        workspace_id=workspace_id,
        min_similarity=min_similarity,
        limit=limit,
    )
    return {
        "workspace_id": workspace_id,
        "total_links": len(links),
        "links": [link.model_dump() for link in links],
    }
