from typing import cast

from database import get_db
from dependencies import require_workspace_read, require_workspace_write
from fastapi import APIRouter, Depends, HTTPException, status
from models.workspace import Workspace
from schemas.flashcard import (
    FlashcardGenerateRequest,
    FlashcardResponse,
    FlashcardUpdate,
)
from services.flashcard_service import (
    FlashcardConflictError,
    FlashcardGenerationError,
    FlashcardNotFoundError,
    FlashcardService,
    InvalidFlashcardSourceError,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(
    prefix="/workspaces/{workspace_id}/nodes/{node_id}/flashcards",
    tags=["Node Flashcards"],
)


@router.get("", response_model=list[FlashcardResponse])
async def list_flashcards(
    workspace_id: str,
    node_id: str,
    workspace: Workspace = Depends(require_workspace_read),
    db: AsyncSession = Depends(get_db),
) -> list[FlashcardResponse]:
    try:
        cards = await FlashcardService.list_for_node(
            db=db,
            workspace_id=workspace_id,
            node_id=node_id,
        )
        return cast(list[FlashcardResponse], cards)
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/generate",
    response_model=list[FlashcardResponse],
    status_code=status.HTTP_201_CREATED,
)
async def generate_flashcards(
    workspace_id: str,
    node_id: str,
    body: FlashcardGenerateRequest,
    workspace: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> list[FlashcardResponse]:
    try:
        cards = await FlashcardService.generate_for_node(
            db=db,
            workspace_id=workspace_id,
            node_id=node_id,
            request=body,
        )
        return cast(list[FlashcardResponse], cards)
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except InvalidFlashcardSourceError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except FlashcardConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except FlashcardGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.patch("/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard(
    workspace_id: str,
    node_id: str,
    flashcard_id: str,
    body: FlashcardUpdate,
    workspace: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> FlashcardResponse:
    try:
        return await FlashcardService.update_card(
            db=db,
            workspace_id=workspace_id,
            node_id=node_id,
            card_id=flashcard_id,
            data=body,
        )
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete("/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard(
    workspace_id: str,
    node_id: str,
    flashcard_id: str,
    workspace: Workspace = Depends(require_workspace_write),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await FlashcardService.delete_card(
            db=db,
            workspace_id=workspace_id,
            node_id=node_id,
            card_id=flashcard_id,
        )
    except FlashcardNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
