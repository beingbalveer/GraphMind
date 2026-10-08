from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import ConfigDict, Field, JsonValue, field_validator, model_validator
from schemas.flashcard import BaseSchema


class CurriculumSchema(BaseSchema):
    model_config = ConfigDict(extra="forbid")


class Duration(CurriculumSchema):
    value: Decimal = Field(gt=0)
    unit: Literal["weeks", "months"]

    @model_validator(mode="after")
    def whole_study_weeks(self) -> "Duration":
        weeks = self.value * (4 if self.unit == "months" else 1)
        if weeks != weeks.to_integral_value() or not 1 <= weeks <= 104:
            raise ValueError(
                "Choose a duration equal to 1–104 whole study weeks (one month = four weeks)"
            )
        return self


class RoadmapRequest(CurriculumSchema):
    title: str | None = Field(default=None, max_length=180)
    prompt: str = Field(min_length=10, max_length=8000)
    level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    background: str | None = Field(default=None, max_length=4000)
    duration: Duration | None = None
    hours_per_week: Decimal | None = Field(default=None, ge=Decimal("0.5"), le=80)

    @field_validator("title", "background", mode="before")
    @classmethod
    def optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("prompt")
    @classmethod
    def useful_prompt(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Describe your learning goal in at least ten characters")
        return value

    @field_validator("hours_per_week")
    @classmethod
    def half_hour_steps(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value % Decimal("0.5"):
            raise ValueError("Use half-hour increments for hours per week")
        return value


class LearningProfile(RoadmapRequest):
    study_weeks: int | None = Field(default=None, ge=1, le=104)
    weekly_minutes: int | None = Field(default=None, ge=30, le=4800)
    outcome: str = Field(min_length=1, max_length=2000)
    assumptions: list[str] = Field(default_factory=list, max_length=30)
    known_skills: list[str] = Field(default_factory=list, max_length=100)


class CurriculumItemData(CurriculumSchema):
    id: str = Field(min_length=1, max_length=64)
    kind: Literal["root", "phase", "group", "choice", "topic"]
    title: str = Field(min_length=1, max_length=180)
    brief: str = Field(default="", max_length=4000)
    objectives: list[str] = Field(default_factory=list, max_length=12)
    exercise: str | None = Field(default=None, max_length=4000)
    format: Literal["concepts", "practice", "project"] | None = None
    order: int = Field(ge=0)
    path: Literal["core", "further"] = "core"
    estimate_minutes: int | None = Field(default=None, ge=1, le=100000)
    participation: Literal["active", "archived"] = "active"

    @field_validator("objectives")
    @classmethod
    def objective_lengths(cls, value: list[str]) -> list[str]:
        if any(len(objective) > 500 for objective in value):
            raise ValueError("Keep each objective within 500 characters")
        return value


class CurriculumRelationData(CurriculumSchema):
    source_id: str
    target_id: str
    kind: Literal["contains", "prerequisite", "recommended_next", "alternative"]


class ChoiceData(CurriculumSchema):
    choice_id: str
    selected_id: str
    rationale: str = Field(min_length=1, max_length=2000)


class WeeklySession(CurriculumSchema):
    week: int = Field(ge=1)
    topic_id: str
    sequence: int = Field(ge=0)
    minutes: int = Field(ge=1, le=4800)


class SourceData(CurriculumSchema):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=1000)
    url: str | None = Field(default=None, max_length=2048)
    reference_id: str | None = None
    locator: str | None = Field(default=None, max_length=1000)
    verified_at: datetime
    status: Literal["inspected", "grounded", "unavailable"]
    access: Literal["free", "paid", "unknown"]
    kind: str = Field(min_length=1, max_length=100)
    evidence: str = Field(max_length=32768)
    provenance: dict[str, JsonValue] = Field(default_factory=dict)


class ResourceData(CurriculumSchema):
    topic_id: str
    source_id: str
    order: int = Field(ge=0)
    rationale: str = Field(max_length=2000)


class CurriculumCandidate(CurriculumSchema):
    title: str = Field(min_length=1, max_length=180)
    outcome: str = Field(min_length=1, max_length=2000)
    assumptions: list[str] = Field(default_factory=list, max_length=30)
    items: list[CurriculumItemData] = Field(min_length=1, max_length=1200)
    relations: list[CurriculumRelationData] = Field(default_factory=list, max_length=5000)
    choices: list[ChoiceData] = Field(default_factory=list, max_length=200)
    sessions: list[WeeklySession] = Field(default_factory=list, max_length=10000)
    resources: list[ResourceData] = Field(default_factory=list, max_length=600)


class ValidationIssue(CurriculumSchema):
    code: str
    item_id: str | None = None
    message: str
    severity: Literal["error", "warning"] = "error"


class ValidationReport(CurriculumSchema):
    valid: bool
    issues: list[ValidationIssue]
    core_minutes: int
    capacity_minutes: int | None


class TopicProgressData(CurriculumSchema):
    topic_id: str
    status: Literal["not_started", "in_progress", "completed"] = "not_started"
    completed_at: datetime | None = None


class KnowledgeCheckData(CurriculumSchema):
    id: str
    topic_id: str
    session_id: str
    revision_id: str
    rubric: dict[str, JsonValue]
    result: dict[str, JsonValue]
    created_at: datetime


class TopicResourceView(CurriculumSchema):
    source: SourceData
    rationale: str
    order: int


class TopicBrief(CurriculumSchema):
    item: CurriculumItemData
    resources: list[TopicResourceView]
    prerequisites: list[CurriculumItemData]
    progress: TopicProgressData
    default_chat_id: str | None = None
    latest_check: KnowledgeCheckData | None = None


class CurriculumView(CurriculumSchema):
    roadmap_id: str
    workspace_id: str
    canvas_anchor_chat_id: str
    revision_id: str
    profile: LearningProfile
    candidate: CurriculumCandidate
    sources: list[SourceData] = Field(max_length=600)
    progress: dict[str, TopicProgressData]
    validation: ValidationReport


class TopicSessionData(CurriculumSchema):
    id: str
    chat_id: str
    topic_id: str
    revision_id: str
    is_new: bool
    archived: bool = False
    topic_title: str | None = None
    progress: TopicProgressData | None = None
    checks: list[KnowledgeCheckData] = Field(default_factory=list, max_length=100)
    lesson_start_state: Literal["pending", "started", "completed", "interrupted"]
