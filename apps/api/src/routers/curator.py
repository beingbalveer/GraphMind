from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from schemas.curator import AdoptGapRequest, GapAnalysisResponse
from schemas.mastery import ConceptResponse
from services.curator_service import CuratorService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/workspaces/{workspace_id}/curator", tags=["Knowledge Curator & Evolution"])


@router.get("/gaps", response_model=GapAnalysisResponse)
async def get_workspace_knowledge_gaps(
    workspace_id: str,
    staleness_days: int = Query(default=14, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> GapAnalysisResponse:
    """
    Perform gap analysis comparing the workspace's explored concepts against the
    domain dependency graph. Identifies missing and weak prerequisites, providing
    actionable educational rationales.
    """
    try:
        return await CuratorService.analyze_workspace_gaps(
            db,
            workspace_id=workspace_id,
            staleness_days=staleness_days,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/gaps/{gap_id:path}/adopt", response_model=ConceptResponse, status_code=status.HTTP_201_CREATED)
async def adopt_knowledge_gap(
    workspace_id: str,
    gap_id: str,
    payload: AdoptGapRequest = AdoptGapRequest(),
    db: AsyncSession = Depends(get_db),
) -> ConceptResponse:
    """
    Adopts a detected knowledge gap into the workspace as a tracked concept
    so the user can begin exploring or taking quizzes on it.
    """
    try:
        return await CuratorService.adopt_gap_concept(
            db,
            workspace_id=workspace_id,
            gap_id=gap_id,
            initial_mastery_level=payload.initial_mastery_level or "unexplored",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
