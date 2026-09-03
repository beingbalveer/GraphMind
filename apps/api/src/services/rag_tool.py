from typing import Any, Dict, List, Optional

import structlog
from ai_core.base import BaseTool
from database import get_session_factory
from pydantic import BaseModel, Field
from services.rag_service import rag_service

logger = structlog.get_logger()


class SearchKnowledgeBaseInput(BaseModel):
    query: str = Field(
        ...,
        description="Technical question or keyword phrase to search across uploaded documents and knowledge base files.",
    )
    workspace_id: str = Field(
        ...,
        description="Active workspace ID containing indexed files.",
    )
    top_k: int = Field(
        default=5,
        description="Number of top relevant source chunks to return (default: 5).",
    )
    file_ids: Optional[List[str]] = Field(
        default=None,
        description="Optional list of specific file IDs to scope the search to.",
    )


class SearchKnowledgeBaseTool(BaseTool):
    name = "search_knowledge_base"
    description = (
        "Performs hybrid vector and full-text keyword retrieval across all uploaded files, PDFs, "
        "code, and documents in the workspace. Returns verified chunks with filename, page number, "
        "section, and relevance score."
    )
    parameters_schema = SearchKnowledgeBaseInput

    async def execute(
        self,
        query: str,
        workspace_id: str,
        top_k: int = 5,
        file_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        session_factory = get_session_factory()
        async with session_factory() as session:
            chunks = await rag_service.hybrid_search(
                db=session,
                workspace_id=workspace_id,
                query=query,
                file_ids=file_ids,
                top_k=top_k,
            )
            grounded = rag_service.build_grounded_context(chunks)
            return {
                "query": query,
                "total_chunks_found": grounded.total_chunks,
                "citations": grounded.citations,
                "context_excerpts": grounded.context_text,
            }
