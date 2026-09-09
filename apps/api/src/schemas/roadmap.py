from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class RoadmapGenerateRequest(BaseSchema):
    goal: str = Field(..., min_length=2, max_length=255, description="Primary learning goal or topic")
    level: str = Field(
        default="beginner",
        description="Target expertise level: beginner, intermediate, or advanced",
    )
    focus: str = Field(
        default="concepts",
        description="Curriculum emphasis: concepts, projects, or interview",
    )
    provider: Optional[str] = Field(default=None, description="Optional LLM provider override")
    model: Optional[str] = Field(default=None, description="Optional foundation model override")


class RoadmapTopic(BaseSchema):
    id: str = Field(..., description="Unique temporary topic key (e.g. t1, t2)")
    title: str = Field(..., description="Topic headline")
    description: str = Field(..., description="Concise synopsis of the topic and why it matters")
    depth: int = Field(default=1, description="Topological level: 0=root, 1=foundational, 2=intermediate, 3=advanced")
    prerequisites: List[str] = Field(default_factory=list, description="IDs of preceding topics that unlock this")
    key_concepts: List[str] = Field(default_factory=list, description="Core keywords or subtopics covered")
    estimated_hours: Optional[int] = Field(default=2, description="Estimated study hours")


class RoadmapPlan(BaseSchema):
    title: str = Field(..., description="Title for the generated workspace")
    description: str = Field(..., description="Summary overview of the learning journey")
    topics: List[RoadmapTopic] = Field(default_factory=list, description="List of structured topic nodes")


class RoadmapGenerateResponse(BaseSchema):
    workspace_id: str = Field(..., description="Created workspace ID")
    root_node_id: str = Field(..., description="Primary root node ID of the roadmap")
    topic_count: int = Field(..., description="Total number of topic nodes created")
    title: str = Field(..., description="Generated workspace title")
    description: Optional[str] = Field(default=None, description="Workspace description")
