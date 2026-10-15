from typing import Dict, Optional

import structlog
from models.workspace import NodeModel
from schemas.workspace import SearchFileHit, SearchNodeHit, WorkspaceSearchResponse
from services.rag_service import RAGService
from services.semantic_service import SemanticService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

# Hard ceiling so a single search cannot fan out unboundedly.
MAX_RESULTS = 20
# Preview length for a file chunk snippet returned to the client.
SNIPPET_LENGTH = 280


class SearchService:
    """
    Inventory-backed workspace search.

    Reuses the already-exposed retrieval services instead of introducing a new
    discovery engine:

    - :class:`SemanticService` performs pgvector cosine search over the
      workspace's embedded conversation nodes (the "graph" search).
    - :class:`RAGService` performs the dual dense + sparse hybrid retrieval over
      embedded workspace file chunks (the "hybrid" search).

    Both legs are strictly scoped to a single authorized ``workspace_id``; the
    router enforces read membership before this service is ever called.
    """

    def __init__(self, provider_name: Optional[str] = None) -> None:
        self.semantic_service = SemanticService(provider_name)
        self.rag_service = RAGService(provider_name)

    async def _resolve_root_chat_ids(
        self,
        db: AsyncSession,
        workspace_id: str,
    ) -> Dict[str, str]:
        """
        Map every node in the workspace to its conversation root node id.

        A node result must resolve to a canonical chat for navigation. Rather
        than issuing one ancestor walk per hit, read the workspace's node graph
        once and walk parents in memory (cycle-safe).
        """
        stmt = select(NodeModel.id, NodeModel.parent_id).where(
            NodeModel.workspace_id == workspace_id
        )
        rows = (await db.execute(stmt)).all()
        parent_of: Dict[str, Optional[str]] = {
            node_id: parent_id for node_id, parent_id in rows
        }

        roots: Dict[str, str] = {}
        for node_id in parent_of:
            current = node_id
            seen: set[str] = set()
            while current not in seen:
                seen.add(current)
                parent = parent_of.get(current)
                if parent is None or parent not in parent_of:
                    break
                current = parent
            roots[node_id] = current
        return roots

    async def search(
        self,
        db: AsyncSession,
        workspace_id: str,
        query: str,
        top_k: int = 8,
        min_similarity: float = 0.0,
    ) -> WorkspaceSearchResponse:
        """
        Run the graph and hybrid search legs for an authorized workspace.

        Empty or whitespace-only queries return an explicit empty result rather
        than a 500, so the client can render an honest empty state.
        """
        cleaned = (query or "").strip()
        if not cleaned:
            return WorkspaceSearchResponse(
                workspace_id=workspace_id,
                query=query or "",
                nodes=[],
                files=[],
                total_nodes=0,
                total_files=0,
            )

        limit = max(1, min(int(top_k), MAX_RESULTS))

        node_matches = await self.semantic_service.search_workspace_nodes(
            db=db,
            workspace_id=workspace_id,
            query=cleaned,
            top_k=limit,
            min_similarity=min_similarity,
        )

        chat_ids = (
            await self._resolve_root_chat_ids(db, workspace_id) if node_matches else {}
        )
        node_hits = [
            SearchNodeHit(
                node_id=match.node_id,
                chat_id=chat_ids.get(match.node_id, match.node_id),
                role=match.role,
                content=match.content,
                highlighted_context=match.highlighted_context,
                similarity_score=match.similarity_score,
                created_at=match.created_at,
                metadata=match.metadata,
            )
            for match in node_matches
        ]

        chunks = await self.rag_service.hybrid_search(
            db=db,
            workspace_id=workspace_id,
            query=cleaned,
            top_k=limit,
        )
        file_hits = [
            SearchFileHit(
                file_id=chunk.file_id,
                filename=chunk.filename,
                chunk_id=chunk.chunk_id,
                chunk_index=chunk.chunk_index,
                snippet=chunk.content[:SNIPPET_LENGTH].strip(),
                page_number=chunk.page_number,
                section_header=chunk.section_header,
                score=round(chunk.score, 6),
            )
            for chunk in chunks
        ]

        logger.info(
            "Executed inventory-backed workspace search",
            workspace_id=workspace_id,
            query=cleaned,
            node_results=len(node_hits),
            file_results=len(file_hits),
        )

        return WorkspaceSearchResponse(
            workspace_id=workspace_id,
            query=cleaned,
            nodes=node_hits,
            files=file_hits,
            total_nodes=len(node_hits),
            total_files=len(file_hits),
        )
