from datetime import datetime
from typing import List, Literal, Optional

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
