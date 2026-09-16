from typing import Literal, Optional

from pydantic import Field
from schemas.roadmap import BaseSchema


class RoadmapSource(BaseSchema):
    title: str = Field(min_length=1, max_length=240)
    url: str = Field(min_length=8, max_length=2048)
    domain: str = Field(min_length=1, max_length=255)
    snippet: str = Field(default="", max_length=1000)


class RoadmapBlueprintNode(BaseSchema):
    id: str = Field(min_length=1, max_length=100)
    parent_id: Optional[str] = None
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=1200)
    kind: Literal["root", "phase", "module", "topic"]
    depth: int = Field(ge=0, le=5)
    estimated_hours: int = Field(default=2, ge=1, le=100)
    learning_action: Optional[str] = Field(default=None, max_length=500)
    project_checkpoint: Optional[str] = Field(default=None, max_length=500)
    source_urls: list[str] = Field(default_factory=list)


class RoadmapBlueprint(BaseSchema):
    title: str = Field(min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=1200)
    profile_id: str = Field(min_length=1, max_length=100)
    nodes: list[RoadmapBlueprintNode]
    sources: list[RoadmapSource] = Field(default_factory=list)


class RoadmapProgressEvent(BaseSchema):
    stage: Literal["planning", "researching", "composing", "validating", "complete", "error"]
    message: str
    source_count: int = Field(default=0, ge=0)
    outline: list[str] = Field(default_factory=list)
    workspace_id: Optional[str] = None
    root_node_id: Optional[str] = None
