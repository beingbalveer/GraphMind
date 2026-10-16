"""Save-copy / enrollment DTOs (LSI-028).

These schemas are the signed-in private boundary described in LSI-002 §4: a
learner saves one published public snapshot into an authorized workspace and
receives the private copy identity. They are intentionally separate from the
public DTOs (``schemas/public.py``): nothing here is ever served anonymously, and
the response only exposes the caller's own private IDs and progress.
"""

from datetime import datetime

from pydantic import Field, field_validator
from schemas.curriculum import CurriculumSchema, TopicProgressData
from schemas.public import SNAPSHOT_VERSION_PATTERN, TEMPLATE_ID_PATTERN


class SaveRoadmapCopyRequest(CurriculumSchema):
    """Request to save one published snapshot into an authorized workspace."""

    template_id: str = Field(min_length=1, max_length=64, pattern=TEMPLATE_ID_PATTERN)
    snapshot_version: str = Field(min_length=1, max_length=32, pattern=SNAPSHOT_VERSION_PATTERN)
    custom_title: str | None = Field(default=None, max_length=180)

    @field_validator("custom_title")
    @classmethod
    def normalized_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class EnrollmentTopicMap(CurriculumSchema):
    """One durable public-topic → private-topic mapping for a saved copy."""

    public_topic_id: str = Field(min_length=1, max_length=64)
    private_topic_id: str = Field(min_length=1, max_length=64)


class EnrollmentDetail(CurriculumSchema):
    """The private identity of a saved copy, returned on create or reuse."""

    roadmap_id: str = Field(min_length=1, max_length=64)
    workspace_id: str = Field(min_length=1, max_length=64)
    revision_id: str = Field(min_length=1, max_length=64)
    source_snapshot_ref: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=180)
    created_at: datetime
    updated_at: datetime
    topic_progress: dict[str, TopicProgressData] = Field(default_factory=dict)
    topic_map: list[EnrollmentTopicMap] = Field(default_factory=list, max_length=1200)
