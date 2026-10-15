"""Immutable public learning DTOs (LSI-025).

These schemas define the *public* boundary described in LSI-002 §3 and §4. They
are intentionally separate from the private curriculum schemas: only vetted
lesson and reference data crosses this boundary, and no private workspace,
roadmap, revision, chat, upload, or progress identity is ever projected here.

Publication input (``PublicSnapshotPublication``) is used by the curated
seed/publish tooling; the remaining schemas are the frozen read models the
public catalog/lesson APIs (LSI-026/LSI-027) build on.
"""

from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator
from schemas.curriculum import CurriculumSchema

PublicLevel = Literal["beginner", "intermediate", "advanced"]
PublicPath = Literal["core", "further"]
PublicLessonFormat = Literal["concepts", "practice", "project"]
PublicSnapshotStatus = Literal["published", "unpublished"]

TEMPLATE_ID_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"
SNAPSHOT_VERSION_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$"


class PublicSourceReference(CurriculumSchema):
    """A single vetted public source. Private provenance is never projected."""

    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=1000)
    url: str | None = Field(default=None, max_length=2048)
    locator: str | None = Field(default=None, max_length=1000)
    kind: str = Field(min_length=1, max_length=100)


class PublicTopicSummary(CurriculumSchema):
    """Frozen public topic identity inside one roadmap snapshot."""

    id: str = Field(min_length=1, max_length=64)
    slug: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=180)
    brief: str = Field(default="", max_length=4000)
    order: int = Field(ge=0)
    path: PublicPath = "core"
    estimate_minutes: int | None = Field(default=None, ge=1, le=100000)
    prerequisites: list[str] = Field(default_factory=list, max_length=64)


class PublicPhaseDetail(CurriculumSchema):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=180)
    order: int = Field(ge=0)
    topics: list[PublicTopicSummary] = Field(default_factory=list, max_length=1200)


class PublicRoadmapSummary(CurriculumSchema):
    """Catalog card. Deliberately carries counts, never private metadata."""

    id: str = Field(min_length=1, max_length=64, description="Public template identifier")
    slug: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=180)
    summary: str = Field(max_length=2000)
    category: str = Field(min_length=1, max_length=64)
    level: PublicLevel
    estimated_weeks: int = Field(ge=1, le=104)
    hours_per_week: float = Field(gt=0, le=80)
    topic_count: int = Field(ge=1)
    snapshot_version: str = Field(min_length=1, max_length=32)
    tags: list[str] = Field(default_factory=list, max_length=20)
    updated_at: datetime


class PublicRoadmapSummaryList(CurriculumSchema):
    items: list[PublicRoadmapSummary]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class PublicRoadmapDetail(CurriculumSchema):
    id: str = Field(min_length=1, max_length=64)
    slug: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=180)
    summary: str = Field(max_length=2000)
    category: str = Field(min_length=1, max_length=64)
    level: PublicLevel
    snapshot_version: str = Field(min_length=1, max_length=32)
    outcomes: list[str] = Field(default_factory=list, max_length=50)
    prerequisites: list[str] = Field(default_factory=list, max_length=50)
    phases: list[PublicPhaseDetail] = Field(default_factory=list, max_length=200)
    sources: list[PublicSourceReference] = Field(default_factory=list, max_length=600)


class PublicLessonDetail(CurriculumSchema):
    template_id: str = Field(min_length=1, max_length=64)
    snapshot_version: str = Field(min_length=1, max_length=32)
    topic_id: str = Field(min_length=1, max_length=64)
    topic_slug: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=180)
    brief: str = Field(default="", max_length=4000)
    objectives: list[str] = Field(default_factory=list, max_length=12)
    # ``None`` means no authored body exists yet; the learner sees an honest
    # "not yet generated" state rather than an empty lesson (LSI-008).
    content_markdown: str | None = Field(default=None, max_length=65536)
    exercise: str | None = Field(default=None, max_length=4000)
    format: PublicLessonFormat | None = None
    estimate_minutes: int | None = Field(default=None, ge=1, le=100000)
    sources: list[PublicSourceReference] = Field(default_factory=list, max_length=600)


class PublicSnapshotPublication(CurriculumSchema):
    """Strict, curated input for one controlled publication.

    Values not supplied are derived from the validated private curriculum
    profile (level, study weeks, hours per week, summary), so a curator only
    states the identity and catalog facets that a curriculum cannot express.
    """

    template_id: str = Field(min_length=1, max_length=64, pattern=TEMPLATE_ID_PATTERN)
    snapshot_version: str = Field(min_length=1, max_length=32, pattern=SNAPSHOT_VERSION_PATTERN)
    slug: str | None = Field(default=None, min_length=1, max_length=64)
    category: str = Field(default="general", min_length=1, max_length=64)
    summary: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    outcomes: list[str] | None = Field(default=None, max_length=50)
    prerequisites: list[str] | None = Field(default=None, max_length=50)
    level: PublicLevel | None = None
    estimated_weeks: int | None = Field(default=None, ge=1, le=104)
    hours_per_week: float | None = Field(default=None, gt=0, le=80)

    @field_validator("slug")
    @classmethod
    def slug_shape(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value or value != value.strip():
            raise ValueError("Provide a valid public slug")
        if not value[0].isalnum() or not all(c.isalnum() or c == "-" for c in value):
            raise ValueError("Use lowercase letters, digits, and hyphens only")
        return value

    @field_validator("tags")
    @classmethod
    def tag_labels(cls, value: list[str]) -> list[str]:
        labels: list[str] = []
        for tag in value:
            label = tag.strip()
            if not label or len(label) > 32:
                raise ValueError("Keep each tag within 32 characters")
            labels.append(label)
        return labels

    @field_validator("outcomes", "prerequisites")
    @classmethod
    def bounded_items(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        if any(not item.strip() or len(item) > 300 for item in value):
            raise ValueError("Keep each entry within 300 characters")
        return [item.strip() for item in value]


class PublicSnapshotRecord(CurriculumSchema):
    """Publication/tooling result. Carries no private source identity."""

    id: str
    template_id: str
    snapshot_version: str
    slug: str
    status: PublicSnapshotStatus
    content_hash: str
    topic_count: int = Field(ge=1)
    published_at: datetime
    unpublished_at: datetime | None = None
