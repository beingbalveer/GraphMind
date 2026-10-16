"""Persisted learner preferences service (LSI-044).

Read/write access is always scoped to the authenticated account — there is no
cross-user or cross-workspace access path. Writes use the row ``version`` for
optimistic concurrency so two tabs cannot silently overwrite each other.
"""

import structlog
from models.user import UserPreferences
from schemas.preferences import (
    DEFAULT_READING_FONT_SIZE,
    DEFAULT_REDUCED_MOTION,
    DEFAULT_STUDY_HOURS,
    DEFAULT_THEME,
    DEFAULT_TUTOR_STYLE,
    UserPreferencesUpdate,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class PreferenceConflictError(ValueError):
    """Raised when an update carries a stale version."""


class PreferencesService:
    @classmethod
    async def get_or_create(
        cls, db: AsyncSession, user_id: str
    ) -> UserPreferences:
        """Return the account's preferences, creating defaults on first read."""
        stmt = select(UserPreferences).where(UserPreferences.user_id == user_id)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            return existing

        prefs = UserPreferences(
            user_id=user_id,
            theme=DEFAULT_THEME,
            reading_font_size=DEFAULT_READING_FONT_SIZE,
            reduced_motion=DEFAULT_REDUCED_MOTION,
            default_study_hours=DEFAULT_STUDY_HOURS,
            tutor_style=DEFAULT_TUTOR_STYLE,
            version=1,
        )
        db.add(prefs)
        await db.flush()
        await db.refresh(prefs)
        logger.info("Created default user preferences", user_id=user_id)
        return prefs

    @classmethod
    async def update(
        cls,
        db: AsyncSession,
        user_id: str,
        payload: UserPreferencesUpdate,
    ) -> UserPreferences:
        """
        Apply a partial update to the caller's own preferences.

        Raises :class:`PreferenceConflictError` when ``payload.version`` does
        not match the stored version (optimistic concurrency).
        """
        prefs = await cls.get_or_create(db, user_id)

        if payload.version is not None and payload.version != prefs.version:
            raise PreferenceConflictError(
                "Preferences were updated elsewhere. Reload and try again."
            )

        changed: list[str] = []
        if payload.theme is not None:
            prefs.theme = payload.theme
            changed.append("theme")
        if payload.reading_font_size is not None:
            prefs.reading_font_size = payload.reading_font_size
            changed.append("reading_font_size")
        if payload.reduced_motion is not None:
            prefs.reduced_motion = payload.reduced_motion
            changed.append("reduced_motion")
        if payload.default_study_hours is not None:
            prefs.default_study_hours = payload.default_study_hours
            changed.append("default_study_hours")
        if payload.tutor_style is not None:
            prefs.tutor_style = payload.tutor_style
            changed.append("tutor_style")

        if changed:
            prefs.version += 1
            await db.flush()
            await db.refresh(prefs)
            logger.info(
                "Updated user preferences",
                user_id=user_id,
                fields=changed,
                version=prefs.version,
            )
        return prefs
