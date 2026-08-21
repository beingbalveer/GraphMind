from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


# ---------------------------------------------------------
# Node Schemas
# ---------------------------------------------------------
class NodeBase(BaseSchema):
    role: str = Field(description="Role: user, assistant, or system")
    content: str = Field(default="", description="Message text content")
    highlighted_context: Optional[str] = Field(default=None, description="Sub-topic quote context")
    provider: Optional[str] = Field(default=None, description="AI Provider name")
    model: Optional[str] = Field(default=None, description="Model identifier")
    position_x: float = Field(default=0.0, description="2D Canvas X coordinate")
    position_y: float = Field(default=0.0, description="2D Canvas Y coordinate")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata dictionary")


class NodeCreate(NodeBase):
    id: Optional[str] = Field(default=None, description="Optional custom node ID")
    parent_id: Optional[str] = Field(default=None, description="Parent node ID in tree")


class NodePositionUpdate(BaseSchema):
    id: str = Field(description="Node ID")
    position_x: float = Field(description="New Canvas X coordinate")
    position_y: float = Field(description="New Canvas Y coordinate")


class NodeResponse(NodeBase):
    id: str
    workspace_id: str
    parent_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------
# Edge Schemas
# ---------------------------------------------------------
class EdgeBase(BaseSchema):
    source_id: str = Field(description="Source parent node ID")
    target_id: str = Field(description="Target child node ID")
    relation_type: str = Field(default="branch", description="Edge relationship type")
    highlighted_context: Optional[str] = Field(default=None, description="Sub-topic excerpt")


class EdgeCreate(EdgeBase):
    id: Optional[str] = Field(default=None, description="Optional custom edge ID")


class EdgeResponse(EdgeBase):
    id: str
    workspace_id: str
    created_at: datetime


# ---------------------------------------------------------
# Workspace Schemas
# ---------------------------------------------------------
class WorkspaceBase(BaseSchema):
    name: str = Field(default="Untitled Workspace", description="Workspace display title")
    description: Optional[str] = Field(default=None, description="Workspace description")
    viewport_x: float = Field(default=0.0, description="Canvas viewport center X")
    viewport_y: float = Field(default=0.0, description="Canvas viewport center Y")
    zoom: float = Field(default=0.85, description="Canvas viewport zoom level")


class WorkspaceCreate(BaseSchema):
    name: str = Field(default="Untitled Workspace", description="Workspace display title")
    description: Optional[str] = Field(default=None, description="Workspace description")


class WorkspaceUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None
    viewport_x: Optional[float] = None
    viewport_y: Optional[float] = None
    zoom: Optional[float] = None


class WorkspaceResponse(WorkspaceBase):
    id: str
    created_at: datetime
    updated_at: datetime
    node_count: Optional[int] = Field(default=0, description="Total nodes in workspace")


class WorkspaceListResponse(BaseSchema):
    workspaces: List[WorkspaceResponse]
    total: int


class GraphSnapshotResponse(BaseSchema):
    workspace: WorkspaceResponse
    nodes: List[NodeResponse]
    edges: List[EdgeResponse]
    root_node_id: Optional[str] = None
    active_node_id: Optional[str] = None


class GraphDeltaUpdateRequest(BaseSchema):
    workspace_update: Optional[WorkspaceUpdate] = None
    moved_nodes: Optional[List[NodePositionUpdate]] = None
