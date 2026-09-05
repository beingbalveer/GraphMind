from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import Field
from schemas.workspace import BaseSchema

ConceptMasteryLevel = Literal["unexplored", "explored", "quizzed", "mastered", "stale"]


class ConceptBase(BaseSchema):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the technical concept")
    description: Optional[str] = Field(default=None, description="Detailed explanation of the concept")
    mastery_level: str = Field(
        default="explored",
        description="Mastery state: unexplored, explored, quizzed, mastered, stale",
    )
    confidence_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 to 1.0",
    )
    times_quizzed: int = Field(default=0, ge=0, description="Total times tested")
    times_correct: int = Field(default=0, ge=0, description="Total correct answers")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom metadata and tags")


class ConceptCreate(ConceptBase):
    id: Optional[str] = Field(default=None, description="Optional custom concept ID")
    node_ids: Optional[List[str]] = Field(default=None, description="Initial node IDs to link")


class ConceptUpdate(BaseSchema):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    mastery_level: Optional[str] = None
    confidence_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    times_quizzed: Optional[int] = Field(default=None, ge=0)
    times_correct: Optional[int] = Field(default=None, ge=0)
    quiz_result: Optional[bool] = Field(
        default=None,
        description="If provided, automatically increments times_quizzed and adjusts confidence score",
    )
    metadata: Optional[Dict[str, Any]] = None


class ConceptResponse(ConceptBase):
    id: str
    workspace_id: str
    last_reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    node_ids: List[str] = Field(default_factory=list)


class NodeConceptsLinkRequest(BaseSchema):
    concept_ids: List[str] = Field(..., min_length=1, description="List of concept IDs to associate with the node")


class ConceptMasteryDistribution(BaseSchema):
    unexplored: int = 0
    explored: int = 0
    quizzed: int = 0
    mastered: int = 0
    stale: int = 0


class WorkspaceMasterySummary(BaseSchema):
    workspace_id: str
    total_concepts: int = 0
    overall_score: float = 0.0
    distribution: ConceptMasteryDistribution = Field(default_factory=ConceptMasteryDistribution)
    top_mastered: List[ConceptResponse] = Field(default_factory=list)
    needing_review: List[ConceptResponse] = Field(default_factory=list)
    concepts: List[ConceptResponse] = Field(default_factory=list)
