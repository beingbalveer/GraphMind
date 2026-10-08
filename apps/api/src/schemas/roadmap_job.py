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
    model_calls: int = Field(default=48, ge=1)
    searches: int = Field(default=20, ge=1)
    unique_fetches: int = Field(default=40, ge=1)
    repair_attempts: int = Field(default=3, ge=1)
    active_seconds: int = Field(default=1200, ge=1)
    lease_seconds: int = Field(default=60, ge=2)
    heartbeat_seconds: int = Field(default=15, ge=1)
    worker_slots: int = Field(default=2, ge=1)


class JobCheckpoint(CurriculumSchema):
    workspace_id: str | None = None
    original_candidate: CurriculumCandidate | None = None
    study_progress: dict[str, TopicProgressData] = Field(default_factory=dict, max_length=1200)
    identity_continuity: dict[str, str] = Field(default_factory=dict, max_length=200)
    profile: LearningProfile | None = None
    sources: list[SourceData] = Field(default_factory=list, max_length=600)
    coverage_notes: list[str] = Field(default_factory=list, max_length=100)
    candidate: CurriculumCandidate | None = None
    validation: ValidationReport | None = None
    loaded_skills: list[str] = Field(default_factory=list, max_length=20)
    clarification_answers: list[str] = Field(default_factory=list, max_length=3)
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
