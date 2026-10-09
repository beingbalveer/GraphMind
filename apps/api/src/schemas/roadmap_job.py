from datetime import datetime
from typing import Literal

from pydantic import Field, JsonValue
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumSchema,
    LearningProfile,
    RoadmapRequest,
    SourceData,
    TopicProgressData,
    ValidationReport,
)

MAX_COVERAGE_TOPICS = 240

JobStatus = Literal[
    "queued", "running", "awaiting_input", "cancel_requested", "canceled", "failed", "completed"
]
StageName = Literal["understand", "research", "compose", "personalize", "validate", "publish"]
JobOperation = Literal["generate", "refine"]


class JobUsage(CurriculumSchema):
    model_calls: int = Field(default=0, ge=0)
    searches: int = Field(default=0, ge=0)
    unique_fetches: int = Field(default=0, ge=0)
    repair_attempts: int = Field(default=0, ge=0)
    active_seconds: float = Field(default=0, ge=0)


class JobLimits(CurriculumSchema):
    model_calls: int = Field(default=80, ge=1)
    searches: int = Field(default=20, ge=1)
    unique_fetches: int = Field(default=40, ge=1)
    repair_attempts: int = Field(default=3, ge=1)
    active_seconds: int = Field(default=3600, ge=1)
    lease_seconds: int = Field(default=60, ge=2)
    heartbeat_seconds: int = Field(default=15, ge=1)
    worker_slots: int = Field(default=2, ge=1)


class AnsweredClarification(CurriculumSchema):
    question_id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=4000)


class ReferenceDisposition(CurriculumSchema):
    source_id: str = Field(min_length=1, max_length=64)
    label_index: int = Field(ge=0, le=1999)
    kind: Literal["concept", "example", "header", "excluded", "synonym"]
    topic_ids: list[str] = Field(default_factory=list, max_length=10)
    reason: str = Field(min_length=1, max_length=300)


class CoverageTopic(CurriculumSchema):
    id: str = Field(
        min_length=1,
        max_length=64,
        description="For NEW concepts use a concise readable slug, not a UUID or reserved topic_<number> handle. Reuse registered topic handles for unchanged original concepts.",
    )
    title: str = Field(
        min_length=1,
        max_length=180,
        description="Concise name of ONE concrete learning concept, not a paragraph or a list of different subtopics. Split distinct concepts into separate entries.",
    )
    area: str = Field(min_length=1, max_length=180)
    source_ids: list[str] = Field(
        min_length=1,
        max_length=10,
        description="Use only the two or three best supporting sources for this concept; do not attach every available source.",
    )


class JobCheckpoint(CurriculumSchema):
    workspace_id: str | None = None
    original_candidate: CurriculumCandidate | None = None
    study_progress: dict[str, TopicProgressData] = Field(default_factory=dict, max_length=1200)
    identity_continuity: dict[str, str] = Field(
        default_factory=dict, max_length=MAX_COVERAGE_TOPICS
    )
    profile: LearningProfile | None = None
    sources: list[SourceData] = Field(default_factory=list, max_length=600)
    coverage_notes: list[str] = Field(default_factory=list, max_length=100)
    coverage_topics: list[CoverageTopic] = Field(
        default_factory=list, max_length=MAX_COVERAGE_TOPICS
    )
    coverage_inventory_plan: dict[str, JsonValue] | None = None
    coverage_inventory_next_area: int = Field(default=0, ge=0, le=20)
    coverage_reference_topics_added: bool = False
    coverage_reference_repaired_labels: list[str] = Field(default_factory=list, max_length=4000)
    reference_dispositions: list[ReferenceDisposition] = Field(
        default_factory=list, max_length=4000
    )
    pending_inventory_review: dict[str, JsonValue] | None = None
    pending_inventory_stage: StageName | None = None
    validation_repair_active: bool = False
    validation_repair_phase: Literal["inventory", "compose", "personalize"] | None = None
    validation_repair_issues: list[str] = Field(default_factory=list, max_length=1000)
    composition_started: bool = False
    detailed_topic_ids: list[str] = Field(default_factory=list, max_length=MAX_COVERAGE_TOPICS)
    candidate: CurriculumCandidate | None = None
    validation: ValidationReport | None = None
    loaded_skills: list[str] = Field(default_factory=list, max_length=20)
    clarification_answers: list[str] = Field(default_factory=list, max_length=3)
    clarification_context: list[AnsweredClarification] = Field(default_factory=list, max_length=3)
    completed_stages: list[StageName] = Field(default_factory=list, max_length=6)


class ClarificationQuestion(CurriculumSchema):
    id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=500)
    suggestions: list[str] = Field(min_length=2, max_length=3)


class StageResult(CurriculumSchema):
    checkpoint: JobCheckpoint
    question: ClarificationQuestion | None = None
    summary: str = Field(min_length=1, max_length=500)


class JobResult(CurriculumSchema):
    proposal_state: Literal["candidate", "applied", "rejected"] | None = None
    workspace_id: str
    roadmap_id: str
    revision_id: str
    kind: Literal["published", "proposal"]


class JobError(CurriculumSchema):
    code: str = Field(min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=500)
    recoverable: bool
    next_action: Literal["retry", "new_run", "answer", "configure_search"]


class JobSnapshot(CurriculumSchema):
    """Private worker state. Never serialize this schema through a public route."""

    id: str
    owner_id: str
    operation: JobOperation
    request: RoadmapRequest
    status: JobStatus
    stage: StageName
    startup_ready: bool
    checkpoint: JobCheckpoint
    usage: JobUsage
    limits: JobLimits
    question: ClarificationQuestion | None
    question_count: int
    error: JobError | None
    result: JobResult | None
    last_sequence: int
    base_revision_id: str | None
    created_at: datetime
    updated_at: datetime


class PublicJobSnapshot(CurriculumSchema):
    target_workspace_id: str | None = None
    id: str
    operation: JobOperation
    title: str | None
    status: JobStatus
    stage: StageName
    startup_ready: bool
    summary: str
    question: ClarificationQuestion | None
    question_count: int
    error: JobError | None
    result: JobResult | None
    last_sequence: int
    created_at: datetime
    updated_at: datetime


class JobEventData(CurriculumSchema):
    sequence: int
    stage: StageName
    type: str
    summary: str
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    created_at: datetime


class Claim(CurriculumSchema):
    job_id: str
    fence: int
    lease_until: datetime
    stage: StageName


class JobReferenceData(CurriculumSchema):
    id: str
    kind: Literal["file", "link"]
    name: str
    status: Literal["staged", "inspected", "unavailable", "rejected"]
    size_bytes: int
    error: str | None = None
    locator: str | None = None


class ReferenceSection(CurriculumSchema):
    reference_id: str
    locator: str
    text: str
