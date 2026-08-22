from typing import Any, Dict, List, Optional

import structlog
from ai_core.providers import get_embedding_provider
from models.workspace import NodeModel
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class SemanticSearchResult(BaseModel):
    """
    Ranked node match returned from semantic vector search.
    """

    node_id: str
    role: str
    content: str
    highlighted_context: Optional[str] = None
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    created_at: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SemanticClusterLink(BaseModel):
    """
    Suggested cross-branch semantic connection between two related thoughts.
    """

    source_node_id: str
    target_node_id: str
    source_preview: str
    target_preview: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    topic_suggestion: Optional[str] = None


class SemanticService:
    """
    Service managing pgvector dense embeddings, vector search, and cross-branch discovery.
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.embedding_provider = get_embedding_provider(provider_name)

    async def compute_and_save_node_embedding(
        self,
        db: AsyncSession,
        node: NodeModel,
    ) -> Optional[List[float]]:
        """
        Generate embedding vector for a node's text content and persist to database.
        """
        if not node.content or not node.content.strip():
            return None

        # Clean text preview for embedding
        text_to_embed = node.content.strip()
        if node.highlighted_context:
            text_to_embed = f"Topic: {node.highlighted_context}\n\n{text_to_embed}"

        try:
            vector = await self.embedding_provider.embed_query(text_to_embed)
            node.embedding = vector
            await db.flush()
            logger.info("Generated and stored node embedding", node_id=node.id, dim=len(vector))
            return vector
        except Exception as e:
            logger.error("Failed to generate node embedding", node_id=node.id, error=str(e))
            return None

    async def search_workspace_nodes(
        self,
        db: AsyncSession,
        workspace_id: str,
        query: str,
        top_k: int = 5,
        min_similarity: float = 0.3,
    ) -> List[SemanticSearchResult]:
        """
        Perform pgvector cosine similarity search across all embedded nodes in a workspace.
        """
        if not query.strip():
            return []

        try:
            query_vector = await self.embedding_provider.embed_query(query.strip())
        except Exception as e:
            logger.error("Failed to embed search query", query=query, error=str(e))
            return []

        # Cosine distance in pgvector: 0 = identical, 2 = opposite.
        # Cosine similarity = 1 - cosine_distance.
        distance_expr = NodeModel.embedding.cosine_distance(query_vector)
        similarity_expr = 1.0 - distance_expr

        stmt = (
            select(
                NodeModel,
                similarity_expr.label("similarity"),
            )
            .where(
                NodeModel.workspace_id == workspace_id,
                NodeModel.embedding.is_not(None),
            )
            .order_by(distance_expr.asc())
            .limit(top_k)
        )

        result = await db.execute(stmt)
        rows = result.all()

        matches: List[SemanticSearchResult] = []
        for node, similarity in rows:
            sim_score = float(similarity) if similarity is not None else 0.0
            # Clamp similarity to [0.0, 1.0]
            sim_score = max(0.0, min(1.0, sim_score))

            if sim_score >= min_similarity:
                matches.append(
                    SemanticSearchResult(
                        node_id=node.id,
                        role=node.role,
                        content=node.content,
                        highlighted_context=node.highlighted_context,
                        similarity_score=round(sim_score, 4),
                        created_at=node.created_at.isoformat() if node.created_at else "",
                        metadata=node.metadata_payload or {},
                    )
                )

        return matches

    async def discover_cross_branch_links(
        self,
        db: AsyncSession,
        workspace_id: str,
        min_similarity: float = 0.75,
        limit: int = 10,
    ) -> List[SemanticClusterLink]:
        """
        Discover semantic connections between disparate nodes across different conversation branches.
        """
        # Fetch all embedded nodes in the workspace
        stmt = (
            select(NodeModel)
            .where(
                NodeModel.workspace_id == workspace_id,
                NodeModel.embedding.is_not(None),
            )
            .order_by(NodeModel.created_at.asc())
        )

        result = await db.execute(stmt)
        nodes = list(result.scalars().all())

        links: List[SemanticClusterLink] = []

        # Compare pairs across different branches (different parent paths)
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                n1 = nodes[i]
                n2 = nodes[j]

                # Skip direct parent-child turns (since they already have a physical tree edge)
                if n1.id == n2.parent_id or n2.id == n1.parent_id or n1.parent_id == n2.parent_id:
                    continue

                if n1.embedding is None or n2.embedding is None:
                    continue

                # Compute cosine similarity
                dot = sum(a * b for a, b in zip(n1.embedding, n2.embedding))
                norm1 = sum(a * a for a in n1.embedding) ** 0.5
                norm2 = sum(b * b for b in n2.embedding) ** 0.5
                similarity = (dot / (norm1 * norm2)) if (norm1 and norm2) else 0.0

                if similarity >= min_similarity:
                    links.append(
                        SemanticClusterLink(
                            source_node_id=n1.id,
                            target_node_id=n2.id,
                            source_preview=n1.content[:100],
                            target_preview=n2.content[:100],
                            similarity_score=round(similarity, 4),
                        )
                    )
                    if len(links) >= limit:
                        return links

        return links
