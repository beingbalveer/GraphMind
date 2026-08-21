import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from ai_core.base import ChatRole


class TreeNode(BaseModel):
    """
    Core data structure representing a message node within a hierarchical
    conversation tree. Supports both camelCase (TS) and snake_case (Python).
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str = Field(
        default_factory=lambda: f"node_{uuid.uuid4().hex[:12]}",
        description="Unique identifier for the tree node",
    )
    parent_id: Optional[str] = Field(
        default=None,
        description="ID of the parent node (None for the root prompt)",
    )
    children_ids: List[str] = Field(
        default_factory=list,
        description="Ordered list of child branch node IDs",
    )
    role: ChatRole = Field(
        ...,
        description="Role of the message author (user, assistant, system)",
    )
    content: str = Field(
        ...,
        description="Textual or markdown content of the message",
    )
    highlighted_context: Optional[str] = Field(
        default=None,
        description="The excerpt of parent text that inspired this branch",
    )
    provider: Optional[str] = Field(
        default=None,
        description="Provider that produced the response (gemini, openai, mock)",
    )
    model: Optional[str] = Field(
        default=None,
        description="Model name used for generation (e.g. gemini-2.5-flash)",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when the node was created",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary metadata such as token counts, latency, or branch tags",
    )

    def add_child(self, child_id: str) -> None:
        """Add a child node ID if not already present."""
        if child_id not in self.children_ids:
            self.children_ids.append(child_id)

    @classmethod
    def create_root(
        cls,
        content: str,
        role: ChatRole = ChatRole.USER,
        node_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "TreeNode":
        """Factory helper creating a standalone root node."""
        kwargs: Dict[str, Any] = {
            "role": role,
            "content": content,
            "parent_id": None,
            "metadata": metadata or {},
        }
        if node_id:
            kwargs["id"] = node_id
        return cls(**kwargs)

    @classmethod
    def create_child(
        cls,
        parent: "TreeNode",
        content: str,
        role: ChatRole,
        highlighted_context: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "TreeNode":
        """Factory helper creating a child node and linking to parent."""
        child = cls(
            parent_id=parent.id,
            role=role,
            content=content,
            highlighted_context=highlighted_context,
            provider=provider,
            model=model,
            metadata=metadata or {},
        )
        parent.add_child(child.id)
        return child


class ConversationTree(BaseModel):
    """
    Container representing a complete conversation tree with fast node lookup.
    Supports both camelCase (TS) and snake_case (Python).
    """

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    id: str = Field(
        default_factory=lambda: f"tree_{uuid.uuid4().hex[:12]}",
        description="Unique identifier for the conversation tree",
    )
    root_node_id: str = Field(
        ...,
        description="ID of the root node of the conversation",
    )
    active_node_id: str = Field(
        ...,
        description="ID of the currently focused/active leaf node in the UI",
    )
    nodes: Dict[str, TreeNode] = Field(
        default_factory=dict,
        description="Map of node ID -> TreeNode for O(1) random access",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )

    def get_node(self, node_id: str) -> Optional[TreeNode]:
        """Retrieve a node by its ID."""
        return self.nodes.get(node_id)

    def add_node(self, node: TreeNode) -> None:
        """Insert a node into the tree and update parent's children list."""
        self.nodes[node.id] = node
        if node.parent_id and node.parent_id in self.nodes:
            self.nodes[node.parent_id].add_child(node.id)
        self.updated_at = datetime.now(timezone.utc)
