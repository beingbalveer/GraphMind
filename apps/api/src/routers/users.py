"""Authenticated user preference routes (LSI-044).

Both routes are self-scoped to the authenticated account via
``get_current_user``; there is deliberately no path to read or write another
user's preferences.
"""

from database import get_db
from dependencies import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.user import User
from schemas.preferences import UserPreferencesResponse, UserPreferencesUpdate
from services.preferences_service import PreferenceConflictError, PreferencesService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/users", tags=["User Preferences"])


@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_my_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferencesResponse:
    """
    Return the authenticated account's persisted preferences, applying and
    persisting defaults on first read.
    """
    prefs = await PreferencesService.get_or_create(db, current_user.id)
    return UserPreferencesResponse.model_validate(prefs)


@router.put("/me/preferences", response_model=UserPreferencesResponse)
async def update_my_preferences(
    payload: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserPreferencesResponse:
    """
    Update the authenticated account's preferences. A supplied ``version`` must
    match the stored version or the request is rejected with ``409``.
    """
    try:
        prefs = await PreferencesService.update(db, current_user.id, payload)
    except PreferenceConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    return UserPreferencesResponse.model_validate(prefs)
