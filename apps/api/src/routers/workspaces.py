from typing import Any, Dict

from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from schemas.workspace import (
    GraphDeltaUpdateRequest,
    GraphSnapshotResponse,
    NodeCreate,
    NodeResponse,
    SemanticSearchRequest,
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from services.semantic_service import SemanticService
from services.workspace_service import WorkspaceService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces", tags=["Workspaces & Persistence"])


@router.get("", response_model=WorkspaceListResponse)
async def list_workspaces(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceListResponse:
    """
    List all workspaces ordered by last modified.
    """
    workspaces, total = await WorkspaceService.list_workspaces(db, limit, offset)
    return WorkspaceListResponse(workspaces=workspaces, total=total)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Create a new workspace for persistent knowledge trees.
    """
    return await WorkspaceService.create_workspace(db, data)


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Get workspace metadata by ID.
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return ws


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
) -> WorkspaceResponse:
    """
    Update workspace metadata or viewport position.
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
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a workspace and all of its associated nodes and edges.
    """
    deleted = await WorkspaceService.delete_workspace(db, workspace_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )


@router.get("/{workspace_id}/graph", response_model=GraphSnapshotResponse)
async def get_graph_snapshot(
    workspace_id: str,
    db: AsyncSession = Depends(get_db),
) -> GraphSnapshotResponse:
    """
    Retrieve full graph topology (nodes, edges, viewport) for a workspace.
    """
    snapshot = await WorkspaceService.get_graph_snapshot(db, workspace_id)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return snapshot


@router.post(
    "/{workspace_id}/nodes", response_model=NodeResponse, status_code=status.HTTP_201_CREATED
)
async def add_node_to_workspace(
    workspace_id: str,
    data: NodeCreate,
    db: AsyncSession = Depends(get_db),
) -> NodeResponse:
    """
    Add a conversation node to a workspace.
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    return await WorkspaceService.add_node_and_edge(db, workspace_id, data)


@router.post("/{workspace_id}/delta")
async def save_graph_delta(
    workspace_id: str,
    delta: GraphDeltaUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Apply debounced delta updates (viewport camera changes and moved node coordinates).
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )
    await WorkspaceService.apply_graph_delta(db, workspace_id, delta)
    return {"status": "ok", "workspace_id": workspace_id}


@router.post("/{workspace_id}/search/semantic")
async def search_workspace_semantic(
    workspace_id: str,
    data: SemanticSearchRequest,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Execute pgvector cosine similarity search across all embedded nodes in this workspace.
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )

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


@router.get("/{workspace_id}/discover/links")
async def discover_cross_branch_links(
    workspace_id: str,
    min_similarity: float = Query(default=0.75, ge=0.0, le=1.0),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Discover cross-branch semantic connection opportunities across disparate turns.
    """
    ws = await WorkspaceService.get_workspace(db, workspace_id)
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{workspace_id}' not found",
        )

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

