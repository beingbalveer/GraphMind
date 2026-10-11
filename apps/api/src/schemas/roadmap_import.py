"""Schemas for importing curated roadmap.sh curricula (no AI involved)."""

from typing import Literal

from pydantic import Field, field_validator
from schemas.curriculum import CurriculumSchema


class RoadmapImportRequest(CurriculumSchema):
    """Body for POST /roadmap/imports: choose roadmap.sh fields."""

    slugs: list[str] = Field(min_length=1, max_length=10)

    @field_validator("slugs")
    @classmethod
    def unique_slugs(cls, value: list[str]) -> list[str]:
        cleaned = [slug.strip().lower() for slug in value if slug.strip()]
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Choose each roadmap field once")
        if not cleaned:
            raise ValueError("Choose at least one roadmap field")
        return cleaned


class RoadmapImportField(CurriculumSchema):
    """A selectable curated field shown in the import picker."""

    slug: str
    title: str
    url: str
    topic_count: int


class RoadmapImportResultItem(CurriculumSchema):
    """Outcome for one imported slug."""

    slug: str
    title: str
    status: Literal["created", "existing"]
    workspace_id: str
    roadmap_id: str
    revision_id: str
    topic_count: int


class RoadmapImportError(CurriculumSchema):
    """Per-slug failure detail."""

    slug: str
    error: str


class RoadmapImportResponse(CurriculumSchema):
    """Results of a bulk import; each slug is created or reported existing."""

    results: list[RoadmapImportResultItem] = Field(default_factory=list)
    errors: list[RoadmapImportError] = Field(default_factory=list)

    @property
    def succeeded(self) -> int:
        return len(self.results)

    @property
    def failed(self) -> int:
        return len(self.errors)
