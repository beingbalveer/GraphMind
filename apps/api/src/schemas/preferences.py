"""Authenticated learner preference contracts (LSI-002 §8, LSI-044).

The approved preference set is intentionally small and observable:

* ``theme`` — ``light`` | ``dark`` | ``system``
* ``reading_font_size`` — ``sm`` | ``md`` | ``lg``
* ``reduced_motion`` — boolean
* ``default_study_hours`` — float (weekly study budget)
* ``tutor_style`` — ``concise`` | ``socratic`` | ``detailed``

Responses always include the current ``version`` so clients can perform an
optimistic-concurrency update; the request accepts an optional ``version`` and
the server rejects a stale write with ``409 Conflict``.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Theme = Literal["light", "dark", "system"]
ReadingFontSize = Literal["sm", "md", "lg"]
TutorStyle = Literal["concise", "socratic", "detailed"]

DEFAULT_THEME: Theme = "system"
DEFAULT_READING_FONT_SIZE: ReadingFontSize = "md"
DEFAULT_REDUCED_MOTION = False
DEFAULT_STUDY_HOURS = 4.0
DEFAULT_TUTOR_STYLE: TutorStyle = "socratic"

STUDY_HOURS_MIN = 0.5
STUDY_HOURS_MAX = 80.0


class BasePreferencesSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class UserPreferencesResponse(BasePreferencesSchema):
    """The persisted preference set returned to the owning account."""

    theme: Theme = DEFAULT_THEME
    reading_font_size: ReadingFontSize = DEFAULT_READING_FONT_SIZE
    reduced_motion: bool = DEFAULT_REDUCED_MOTION
    default_study_hours: float = DEFAULT_STUDY_HOURS
    tutor_style: TutorStyle = DEFAULT_TUTOR_STYLE
    version: int = 1
    updated_at: datetime


class UserPreferencesUpdate(BasePreferencesSchema):
    """
    Partial update of the caller's own preferences.

    ``version`` is optional: when supplied it must match the stored version or
    the server responds ``409`` so a concurrent writer's change is never lost.
    """

    theme: Optional[Theme] = None
    reading_font_size: Optional[ReadingFontSize] = None
    reduced_motion: Optional[bool] = None
    default_study_hours: Optional[float] = Field(
        default=None, ge=STUDY_HOURS_MIN, le=STUDY_HOURS_MAX
    )
    tutor_style: Optional[TutorStyle] = None
    version: Optional[int] = Field(default=None, ge=1)
