from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from schemas.curriculum import (
    CurriculumCandidate,
    CurriculumItemData,
    CurriculumSchema,
    CurriculumView,
    ResourceData,
    TopicProgressData,
    TopicSessionData,
    WeeklySession,
)


class UpdateItem(CurriculumSchema):
    op: Literal["update_item"]
    item_id: str
    title: str | None = Field(default=None, min_length=1, max_length=180)
    brief: str | None = Field(default=None, max_length=4000)
    objectives: list[str] | None = Field(default=None, max_length=12)
    exercise: str | None = Field(default=None, max_length=4000)
    estimate_minutes: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode="after")
    def objectives_bounded(self) -> "UpdateItem":
        if self.objectives and any(len(o) > 500 for o in self.objectives):
            raise ValueError("Keep objectives within 500 characters")
        if self.title is not None and not self.title.strip():
            raise ValueError("Enter a title")
        return self


class AddTopic(CurriculumSchema):
    op: Literal["add_topic"]
    item: CurriculumItemData
    parent_id: str


class RemoveTopic(CurriculumSchema):
    op: Literal["remove_topic"]
    item_id: str


class MoveItem(CurriculumSchema):
    op: Literal["move_item"]
    item_id: str
    parent_id: str
    order: int = Field(ge=0)


class ReplaceResources(CurriculumSchema):
    op: Literal["replace_resources"]
    item_id: str
    resources: list[ResourceData] = Field(max_length=3)


class AssignWeek(CurriculumSchema):
    op: Literal["assign_week"]
    sessions: list[WeeklySession] = Field(max_length=10000)


class SelectAlternative(CurriculumSchema):
    op: Literal["select_alternative"]
    choice_id: str
    selected_id: str


CurriculumPatch = Annotated[
    UpdateItem
    | AddTopic
    | RemoveTopic
    | MoveItem
    | ReplaceResources
    | AssignWeek
    | SelectAlternative,
    Field(discriminator="op"),
]


class EditRequest(CurriculumSchema):
    base_revision_id: str
    patches: list[CurriculumPatch] = Field(min_length=1, max_length=50)
    history_removal_ack: bool = False


class RevisionRequest(CurriculumSchema):
    base_revision_id: str
    history_removal_ack: bool = False


class RevisionSummary(CurriculumSchema):
    id: str
    base_revision_id: str | None
    status: str
    title: str
    created_at: datetime
    added: list[str]
    changed: list[str]
    removed: list[str]
    has_learning_history: bool


class ArchivedTopic(CurriculumSchema):
    item: CurriculumItemData
    progress: TopicProgressData
    sessions: list[TopicSessionData]


class InspectSourceRequest(CurriculumSchema):
    url: str = Field(min_length=1, max_length=2048)


class IdentityChange(CurriculumSchema):
    old_item_id: str
    new_item_id: str
    reason: str


class RevisionDiff(CurriculumSchema):
    added: list[str]
    changed: list[str]
    removed: list[str]
    summary: str
    identity_changes: list[IdentityChange] = Field(default_factory=list)


class RefinementRequest(CurriculumSchema):
    base_revision_id: str
    instruction: str = Field(min_length=10, max_length=8000)

    @field_validator("instruction")
    @classmethod
    def useful_instruction(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10:
            raise ValueError("Describe the change in at least ten characters")
        return value


class RevisionProposalData(CurriculumSchema):
    instruction: str | None = Field(default=None, max_length=8000)
    original: CurriculumCandidate
    view: "CurriculumView"
    base_revision_id: str
    diff: RevisionDiff
    affected_completed_topics: list[str]
    status: str
    outdated: bool
