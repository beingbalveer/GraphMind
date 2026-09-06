from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import Field
from schemas.workspace import BaseSchema

KnowledgeGapSeverity = Literal["high", "medium", "low"]
KnowledgeGapStatus = Literal["missing", "unexplored", "stale", "weak_retention"]


class KnowledgeGap(BaseSchema):
    id: str = Field(..., description="Unique gap identifier or domain concept ID")
    concept_name: str = Field(..., description="Canonical name of the missing/weak concept")
    domain: str = Field(..., description="Knowledge domain, e.g. Python Concurrency, Database Engineering")
    severity: KnowledgeGapSeverity = Field(
        ...,
        description="Gap severity: high (completely missing prerequisite), medium (stale/weak), low (ancillary)",
    )
    status: KnowledgeGapStatus = Field(
        ...,
        description="Detection status: missing, unexplored, stale, weak_retention",
    )
    dependent_concepts: List[str] = Field(
        default_factory=list,
        description="List of concepts explored in the workspace that depend on this prerequisite",
    )
    rationale: str = Field(
        ...,
        description="Educational justification explaining why this prerequisite is critical",
    )
    suggested_action: str = Field(
        ...,
        description="Actionable recommendation (e.g. 'Explore Event Loops', 'Quiz on Coroutines')",
    )
    foundational_importance: str = Field(
        default="core",
        description="Importance level: foundational, core, or specialized",
    )
    prerequisite_ids: List[str] = Field(
        default_factory=list,
        description="Upstream prerequisites for this gap concept",
    )


class GapAnalysisResponse(BaseSchema):
    workspace_id: str = Field(..., description="ID of the analyzed workspace")
    analyzed_at: datetime = Field(..., description="UTC timestamp of the gap analysis run")
    total_gaps: int = Field(default=0, description="Total number of detected knowledge gaps")
    high_severity_count: int = Field(default=0, description="Count of high severity gaps")
    medium_severity_count: int = Field(default=0, description="Count of medium severity gaps")
    gaps: List[KnowledgeGap] = Field(default_factory=list, description="List of prioritized knowledge gaps")
    explored_domains: List[str] = Field(
        default_factory=list,
        description="List of domains detected in user's active workspace concepts",
    )


class AdoptGapRequest(BaseSchema):
    initial_mastery_level: Optional[str] = Field(
        default="unexplored",
        description="Initial mastery level when registering gap into workspace concepts",
    )


TopicReadiness = Literal["ready_to_unlock", "prerequisites_in_progress", "exploratory"]


class TopicRecommendation(BaseSchema):
    id: str = Field(..., description="Canonical concept identifier in domain catalog")
    topic_name: str = Field(..., description="Display name of the recommended topic")
    domain: str = Field(..., description="Knowledge domain")
    readiness: TopicReadiness = Field(
        ...,
        description="Readiness state: ready_to_unlock, prerequisites_in_progress, exploratory",
    )
    readiness_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Computed composite score based on prerequisite satisfaction and domain synergy",
    )
    rationale: str = Field(
        ...,
        description="Pedagogical rationale explaining why this is the optimal next learning step",
    )
    unlocked_by: List[str] = Field(
        default_factory=list,
        description="Prerequisites completed by the user that unlocked this recommendation",
    )
    future_unlocks: List[str] = Field(
        default_factory=list,
        description="Downstream advanced topics that mastering this topic will make accessible",
    )
    suggested_prompt: str = Field(
        ...,
        description="Actionable prompt to kick off exploring this topic in the conversation",
    )
    importance: str = Field(
        default="core",
        description="Concept importance: foundational, core, specialized",
    )


class NextTopicsResponse(BaseSchema):
    workspace_id: str = Field(..., description="Workspace identifier")
    recommendations: List[TopicRecommendation] = Field(
        default_factory=list,
        description="Top recommended topics sorted by priority",
    )
    active_frontier_domains: List[str] = Field(
        default_factory=list,
        description="Domains active in the learner's frontier",
    )
    generated_at: datetime = Field(..., description="Timestamp of recommendation generation")


TimelineEventType = Literal[
    "node_created",
    "branch_created",
    "concept_explored",
    "concept_mastered",
]


class TimelineEvent(BaseSchema):
    id: str = Field(..., description="Unique event identifier")
    timestamp: datetime = Field(..., description="UTC timestamp of the event")
    event_type: TimelineEventType = Field(..., description="Type of evolution event")
    title: str = Field(..., description="Short summary title of the milestone or event")
    description: Optional[str] = Field(default=None, description="Detailed context or snippet")
    entity_id: str = Field(..., description="ID of the associated node or concept")
    is_milestone: bool = Field(default=False, description="Flag indicating significant milestone")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom event metadata")


class WorkspaceTimelineResponse(BaseSchema):
    workspace_id: str = Field(..., description="Workspace identifier")
    start_time: Optional[datetime] = Field(default=None, description="Timestamp of first event")
    end_time: Optional[datetime] = Field(default=None, description="Timestamp of most recent event")
    total_events: int = Field(default=0, description="Total count of historical events")
    events: List[TimelineEvent] = Field(default_factory=list, description="Chronological event log")
    milestones: List[TimelineEvent] = Field(default_factory=list, description="Extracted inflection milestones")
