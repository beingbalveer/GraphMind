from typing import Any, Dict, List

from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from schemas.mastery import (
    ConceptCreate,
    ConceptResponse,
    ConceptUpdate,
    NodeConceptsLinkRequest,
    WorkspaceMasterySummary,
)
from services.mastery_service import MasteryService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["Knowledge Mastery & Evolution"])


@router.get("/mastery", response_model=WorkspaceMasterySummary)
async def get_workspace_mastery(
    workspace_id: str,
    staleness_days: int = Query(default=14, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceMasterySummary:
    """
    Retrieve the full knowledge profile, concept breakdown, and mastery scores for a workspace.
    """
    return await MasteryService.get_workspace_mastery_summary(
        db,
        workspace_id=workspace_id,
        staleness_days=staleness_days,
    )


@router.get("/concepts", response_model=List[ConceptResponse])
async def list_workspace_concepts(
    workspace_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> List[ConceptResponse]:
    """
    List concepts tracked in a workspace.
    """
    return await MasteryService.get_workspace_concepts(
        db,
        workspace_id=workspace_id,
        limit=limit,
        offset=offset,
    )


@router.post("/concepts", response_model=ConceptResponse, status_code=status.HTTP_201_CREATED)
async def create_or_get_concept(
    workspace_id: str,
    data: ConceptCreate,
    db: AsyncSession = Depends(get_db),
) -> ConceptResponse:
    """
    Create a new concept or return existing concept with matching name.
    """
    try:
        return await MasteryService.create_or_get_concept(db, workspace_id=workspace_id, data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/concepts/{concept_id}", response_model=ConceptResponse)
async def get_concept(
    workspace_id: str,
    concept_id: str,
    db: AsyncSession = Depends(get_db),
) -> ConceptResponse:
    """
    Get a single concept by ID.
    """
    concept = await MasteryService.get_concept(db, concept_id=concept_id)
    if not concept or concept.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concept '{concept_id}' not found in workspace",
        )
    return concept


@router.patch("/concepts/{concept_id}", response_model=ConceptResponse)
async def update_concept(
    workspace_id: str,
    concept_id: str,
    data: ConceptUpdate,
    db: AsyncSession = Depends(get_db),
) -> ConceptResponse:
    """
    Update concept metadata, confidence score, or log quiz feedback.
    """
    concept = await MasteryService.get_concept(db, concept_id=concept_id)
    if not concept or concept.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concept '{concept_id}' not found in workspace",
        )
    updated = await MasteryService.update_concept(db, concept_id=concept_id, data=data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concept '{concept_id}' not found",
        )
    return updated


@router.delete("/concepts/{concept_id}", response_model=Dict[str, Any])
async def delete_concept(
    workspace_id: str,
    concept_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Delete a concept from the workspace.
    """
    concept = await MasteryService.get_concept(db, concept_id=concept_id)
    if not concept or concept.workspace_id != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Concept '{concept_id}' not found in workspace",
        )
    success = await MasteryService.delete_concept(db, concept_id=concept_id)
    return {"deleted": success, "conceptId": concept_id}


@router.post("/nodes/{node_id}/concepts", response_model=List[ConceptResponse])
async def link_node_concepts(
    workspace_id: str,
    node_id: str,
    data: NodeConceptsLinkRequest,
    db: AsyncSession = Depends(get_db),
) -> List[ConceptResponse]:
    """
    Associate one or more concepts with a specific conversation node.
    """
    try:
        return await MasteryService.link_node_concepts(
            db,
            node_id=node_id,
            concept_ids=data.concept_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/nodes/{node_id}/concepts", response_model=List[ConceptResponse])
async def get_node_concepts(
    workspace_id: str,
    node_id: str,
    db: AsyncSession = Depends(get_db),
) -> List[ConceptResponse]:
    """
    Retrieve all concepts linked to a given conversation node.
    """
    return await MasteryService.get_node_concepts(db, node_id=node_id)
