import re
from typing import Any, Dict, Optional

import httpx
import structlog
from ai_core.base import BaseTool
from database import get_session_factory
from models.workspace import NodeModel
from pydantic import BaseModel, Field
from schemas.workspace import NodeCreate
from services.semantic_service import SemanticService
from services.workspace_service import WorkspaceService
from sqlalchemy import select

logger = structlog.get_logger()


# 1. SearchGraphTool
class SearchGraphInput(BaseModel):
    query: str = Field(..., description="Semantic query to search across graph nodes")
    workspace_id: Optional[str] = Field(
        default=None, description="Workspace ID (defaults to active workspace)"
    )
    top_k: int = Field(default=5, ge=1, le=20, description="Max matching nodes to return")
    min_similarity: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Minimum cosine similarity threshold (0.0 - 1.0)"
    )


class SearchGraphTool(BaseTool):
    name = "search_graph"
    description = (
        "Performs semantic vector search across conversation nodes in the workspace graph "
        "to discover relevant past thoughts, explanations, and context."
    )
    parameters_schema = SearchGraphInput

    async def execute(
        self,
        query: str,
        workspace_id: Optional[str] = None,
        top_k: int = 5,
        min_similarity: float = 0.0,
    ) -> Dict[str, Any]:
        if not workspace_id or not workspace_id.strip():
            raise ValueError("workspace_id is required to perform graph search.")

        semantic_service = SemanticService()
        factory = get_session_factory()
        async with factory() as db:
            results = await semantic_service.search_workspace_nodes(
                db=db,
                workspace_id=workspace_id.strip(),
                query=query.strip(),
                top_k=top_k,
                min_similarity=min_similarity,
            )

        formatted_matches = [
            {
                "node_id": r.node_id,
                "role": r.role,
                "content_preview": (r.content[:200] + "...") if len(r.content) > 200 else r.content,
                "highlighted_context": r.highlighted_context,
                "similarity": round(r.similarity_score, 3),
            }
            for r in results
        ]
        return {
            "query": query,
            "workspace_id": workspace_id,
            "total_matches": len(formatted_matches),
            "matches": formatted_matches,
        }


# 2. TraverseLineageTool
class TraverseLineageInput(BaseModel):
    node_id: str = Field(..., description="Target node ID in the graph")
    direction: str = Field(
        default="ancestors",
        description="Traversal direction: 'ancestors' (up to root) or 'children' (branching sub-tree)",
    )
    workspace_id: Optional[str] = Field(
        default=None, description="Workspace ID containing the graph"
    )


class TraverseLineageTool(BaseTool):
    name = "traverse_lineage"
    description = (
        "Traverses graph connections to retrieve the full ancestor lineage from a node to the root, "
        "or inspect all branching child nodes."
    )
    parameters_schema = TraverseLineageInput

    async def execute(
        self,
        node_id: str,
        direction: str = "ancestors",
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not workspace_id or not workspace_id.strip():
            raise ValueError("workspace_id is required to traverse graph lineage.")

        factory = get_session_factory()
        async with factory() as db:
            snapshot = await WorkspaceService.get_graph_snapshot(db, workspace_id.strip())

        nodes_by_id = {n.id: n for n in snapshot.nodes}
        if node_id not in nodes_by_id:
            return {
                "error": f"Node '{node_id}' was not found in workspace '{workspace_id}'.",
                "nodes": [],
            }

        target_nodes = []
        if direction == "children":
            children = [n for n in snapshot.nodes if n.parent_id == node_id]
            target_nodes = children
        else:
            # Ancestor traversal up to root
            curr_id = node_id
            visited = set()
            while curr_id and curr_id in nodes_by_id and curr_id not in visited:
                visited.add(curr_id)
                node = nodes_by_id[curr_id]
                target_nodes.append(node)
                curr_id = node.parent_id

            # Reverse so it reads chronologically from root to target
            target_nodes.reverse()

        return {
            "node_id": node_id,
            "direction": direction,
            "count": len(target_nodes),
            "lineage": [
                {
                    "node_id": n.id,
                    "parent_id": n.parent_id,
                    "role": n.role,
                    "content_preview": (n.content[:150] + "...")
                    if len(n.content) > 150
                    else n.content,
                    "highlighted_context": n.highlighted_context,
                }
                for n in target_nodes
            ],
        }


# 3. CreateSubnodeTool
class CreateSubnodeInput(BaseModel):
    parent_id: Optional[str] = Field(
        default=None,
        description="Parent node ID to attach this new thought branch to. Omit or pass null to attach to the current conversation node.",
    )
    content: str = Field(..., description="Textual content for the sub-node")
    highlighted_context: Optional[str] = Field(
        default=None, description="Optional focus concept or quoted excerpt"
    )
    branch_type: Optional[str] = Field(
        default="assistant", description="Branch type: assistant, research, quiz, or summary"
    )
    workspace_id: Optional[str] = Field(
        default=None, description="Workspace ID to create the sub-node in"
    )


class CreateSubnodeTool(BaseTool):
    name = "create_subnode"
    description = (
        "Appends a structured sub-node to an existing thought branch in the knowledge graph. "
        "Useful for recording research findings, quizzes, or structured sub-analyses."
    )
    parameters_schema = CreateSubnodeInput

    async def execute(
        self,
        content: str,
        parent_id: Optional[str] = None,
        highlighted_context: Optional[str] = None,
        branch_type: Optional[str] = "assistant",
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not workspace_id or not workspace_id.strip():
            raise ValueError("workspace_id is required to create a sub-node.")

        factory = get_session_factory()
        async with factory() as db:
            resolved_parent_id: Optional[str] = None
            candidate = (parent_id or "").strip()
            placeholder_values = {
                "current_node_id",
                "current",
                "root",
                "null",
                "undefined",
                "none",
                "",
            }

            # If a candidate parent was passed and isn't a placeholder, verify it exists
            if candidate and candidate.lower() not in placeholder_values:
                parent_node = await db.get(NodeModel, candidate)
                if parent_node and parent_node.workspace_id == workspace_id.strip():
                    resolved_parent_id = parent_node.id

            # Fallback: if parent_id is missing or not found in DB, resolve to latest workspace node
            if not resolved_parent_id:
                stmt = (
                    select(NodeModel)
                    .where(NodeModel.workspace_id == workspace_id.strip())
                    .order_by(NodeModel.created_at.desc())
                    .limit(1)
                )
                res = await db.execute(stmt)
                latest_node = res.scalar_one_or_none()
                if latest_node:
                    resolved_parent_id = latest_node.id

            node_data = NodeCreate(
                parent_id=resolved_parent_id,
                role="assistant",
                content=content.strip(),
                highlighted_context=highlighted_context,
                metadata={"branch_type": branch_type or "assistant", "created_by": "agent"},
            )
            created_node = await WorkspaceService.add_node_and_edge(
                session=db, workspace_id=workspace_id.strip(), data=node_data
            )
            await db.commit()

        logger.info(
            "Agent successfully created graph sub-node",
            node_id=created_node.id,
            parent_id=resolved_parent_id,
            workspace_id=workspace_id,
        )
        return {
            "success": True,
            "node_id": created_node.id,
            "parent_id": created_node.parent_id,
            "role": created_node.role,
            "branch_type": branch_type,
            "content_preview": (created_node.content[:100] + "...")
            if len(created_node.content) > 100
            else created_node.content,
        }


# 4. FetchUrlTool
class FetchUrlInput(BaseModel):
    url: str = Field(..., description="Public web URL or documentation page to fetch")
    max_chars: int = Field(default=4000, ge=100, le=10000, description="Max characters to return")


class FetchUrlTool(BaseTool):
    name = "fetch_url"
    description = (
        "Fetches external web documentation, articles, or API specifications via HTTP "
        "and extracts plain readable text."
    )
    parameters_schema = FetchUrlInput

    async def execute(self, url: str, max_chars: int = 4000) -> Dict[str, Any]:
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = f"https://{clean_url}"

        headers = {
            "User-Agent": "GraphMind-ResearchAgent/1.0 (+https://github.com/beingbalveer/GraphMind)"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(clean_url, headers=headers)
                resp.raise_for_status()
                raw_text = resp.text

            # Clean HTML tags and excessive whitespace
            clean_text = re.sub(
                r"<script.*?</script>", "", raw_text, flags=re.DOTALL | re.IGNORECASE
            )
            clean_text = re.sub(
                r"<style.*?</style>", "", clean_text, flags=re.DOTALL | re.IGNORECASE
            )
            clean_text = re.sub(r"<[^>]+>", " ", clean_text)
            clean_text = re.sub(r"\s+", " ", clean_text).strip()

            truncated = len(clean_text) > max_chars
            extracted_text = clean_text[:max_chars] if truncated else clean_text

            return {
                "url": str(resp.url),
                "status_code": resp.status_code,
                "text": extracted_text,
                "truncated": truncated,
                "total_chars": len(clean_text),
            }
        except Exception as err:
            raise RuntimeError(f"Failed to fetch content from '{clean_url}': {str(err)}") from err
