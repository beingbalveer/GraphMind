import re
from typing import Any, Dict, List, Optional

import structlog
from ai_core.providers import get_embedding_provider
from models.workspace import WorkspaceFile, WorkspaceFileChunk
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

STOPWORDS = {
    "what", "when", "where", "which", "who", "whom", "this", "that", "these",
    "those", "am", "is", "are", "was", "were", "be", "been", "being", "have",
    "has", "had", "having", "do", "does", "did", "doing", "would", "should",
    "could", "ought", "the", "and", "but", "if", "or", "because", "as", "until",
    "while", "of", "at", "by", "for", "with", "about", "against", "between",
    "into", "through", "during", "before", "after", "above", "below", "to", "from",
    "up", "down", "in", "out", "on", "off", "over", "under", "again", "further",
    "then", "once", "here", "there", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same",
    "so", "than", "too", "very", "can", "will", "just", "now", "happens", "happen"
}


class RetrievedChunk(BaseModel):
    """
    Ranked chunk returned by the hybrid retrieval pipeline with provenance metadata.
    """

    chunk_id: str
    file_id: str
    filename: str
    chunk_index: int
    content: str
    enriched_content: str
    page_number: Optional[int] = None
    section_header: Optional[str] = None
    score: float = Field(..., ge=0.0)
    dense_rank: Optional[int] = None
    sparse_rank: Optional[int] = None


class GroundedContext(BaseModel):
    """
    Structured context and citation lookup table for LLM injection.
    """

    context_text: str
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    total_chunks: int = 0


class RAGService:
    """
    Enterprise-grade Hybrid RAG service combining pgvector dense embeddings
    with PostgreSQL tsvector full-text search via Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, provider_name: Optional[str] = None):
        self.embedding_provider = get_embedding_provider(provider_name)

    async def hybrid_search(
        self,
        db: AsyncSession,
        workspace_id: str,
        query: str,
        file_ids: Optional[List[str]] = None,
        top_k: int = 5,
        candidate_k: int = 25,
        rrf_k: int = 60,
    ) -> List[RetrievedChunk]:
        """
        Execute concurrent dense and sparse searches and merge results with RRF.
        """
        cleaned_query = (query or "").strip()
        if not cleaned_query:
            return []

        # 1. Generate query embedding
        query_vector: Optional[List[float]] = None
        try:
            query_vector = await self.embedding_provider.embed_query(cleaned_query)
        except Exception as e:
            logger.warning("Failed to generate query embedding for RAG", query=cleaned_query, error=str(e))

        # 2. Dense Semantic Search (pgvector HNSW)
        dense_results: List[RetrievedChunk] = []
        if query_vector:
            try:
                distance_expr = WorkspaceFileChunk.embedding.cosine_distance(query_vector)
                dense_stmt = (
                    select(
                        WorkspaceFileChunk,
                        WorkspaceFile.name.label("filename"),
                        distance_expr.label("distance"),
                    )
                    .join(WorkspaceFile, WorkspaceFile.id == WorkspaceFileChunk.file_id)
                    .where(WorkspaceFileChunk.workspace_id == workspace_id)
                )
                if file_ids:
                    dense_stmt = dense_stmt.where(WorkspaceFileChunk.file_id.in_(file_ids))

                dense_stmt = dense_stmt.where(WorkspaceFileChunk.embedding.is_not(None))
                dense_stmt = dense_stmt.order_by(distance_expr.asc()).limit(candidate_k)

                dense_exec = await db.execute(dense_stmt)
                for rank, row in enumerate(dense_exec.all(), start=1):
                    chunk_obj, filename, dist = row[0], row[1], float(row[2])
                    sim = max(0.0, 1.0 - dist)
                    dense_results.append(
                        RetrievedChunk(
                            chunk_id=chunk_obj.id,
                            file_id=chunk_obj.file_id,
                            filename=filename,
                            chunk_index=chunk_obj.chunk_index,
                            content=chunk_obj.content,
                            enriched_content=chunk_obj.enriched_content,
                            page_number=chunk_obj.page_number,
                            section_header=chunk_obj.section_header,
                            score=sim,
                            dense_rank=rank,
                        )
                    )
            except Exception as e:
                logger.warning("Dense semantic search failed", error=str(e))

        # 3. Sparse Lexical Search (PostgreSQL tsvector / fallback)
        sparse_results: List[RetrievedChunk] = []
        try:
            # Check database dialect
            bind = db.bind
            is_postgres = bool(bind and "postgresql" in str(bind.url))

            if is_postgres:
                raw_words = re.findall(r"[A-Za-z0-9_]{2,}", cleaned_query)
                search_terms = [w for w in raw_words if w.lower() not in STOPWORDS]
                if not search_terms:
                    search_terms = raw_words

                if search_terms:
                    or_terms_str = " | ".join(search_terms[:15])
                    ts_query = func.to_tsquery("english", or_terms_str)
                else:
                    ts_query = func.plainto_tsquery("english", cleaned_query)

                ts_vector = func.to_tsvector("english", WorkspaceFileChunk.enriched_content)
                rank_expr = func.ts_rank_cd(ts_vector, ts_query)

                sparse_stmt = (
                    select(
                        WorkspaceFileChunk,
                        WorkspaceFile.name.label("filename"),
                        rank_expr.label("rank_score"),
                    )
                    .join(WorkspaceFile, WorkspaceFile.id == WorkspaceFileChunk.file_id)
                    .where(WorkspaceFileChunk.workspace_id == workspace_id)
                    .where(ts_vector.op("@@")(ts_query))
                )
                if file_ids:
                    sparse_stmt = sparse_stmt.where(WorkspaceFileChunk.file_id.in_(file_ids))

                sparse_stmt = sparse_stmt.order_by(rank_expr.desc()).limit(candidate_k)
                sparse_exec = await db.execute(sparse_stmt)
                for rank, row in enumerate(sparse_exec.all(), start=1):
                    chunk_obj, filename, r_score = row[0], row[1], float(row[2])
                    sparse_results.append(
                        RetrievedChunk(
                            chunk_id=chunk_obj.id,
                            file_id=chunk_obj.file_id,
                            filename=filename,
                            chunk_index=chunk_obj.chunk_index,
                            content=chunk_obj.content,
                            enriched_content=chunk_obj.enriched_content,
                            page_number=chunk_obj.page_number,
                            section_header=chunk_obj.section_header,
                            score=r_score,
                            sparse_rank=rank,
                        )
                    )
            else:
                # SQLite / non-Postgres lexical fallback: tokenized ILIKE matching
                terms = [t.strip() for t in cleaned_query.split() if len(t.strip()) > 2]
                if terms:
                    conditions = [WorkspaceFileChunk.enriched_content.ilike(f"%{t}%") for t in terms]
                    fallback_stmt = (
                        select(WorkspaceFileChunk, WorkspaceFile.name.label("filename"))
                        .join(WorkspaceFile, WorkspaceFile.id == WorkspaceFileChunk.file_id)
                        .where(WorkspaceFileChunk.workspace_id == workspace_id)
                        .where(or_(*conditions))
                    )
                    if file_ids:
                        fallback_stmt = fallback_stmt.where(WorkspaceFileChunk.file_id.in_(file_ids))
                    fallback_stmt = fallback_stmt.limit(candidate_k)
                    fb_exec = await db.execute(fallback_stmt)
                    for rank, row in enumerate(fb_exec.all(), start=1):
                        chunk_obj, filename = row[0], row[1]
                        sparse_results.append(
                            RetrievedChunk(
                                chunk_id=chunk_obj.id,
                                file_id=chunk_obj.file_id,
                                filename=filename,
                                chunk_index=chunk_obj.chunk_index,
                                content=chunk_obj.content,
                                enriched_content=chunk_obj.enriched_content,
                                page_number=chunk_obj.page_number,
                                section_header=chunk_obj.section_header,
                                score=1.0 / rank,
                                sparse_rank=rank,
                            )
                        )
        except Exception as e:
            logger.warning("Sparse lexical search failed", error=str(e))

        # 4. Reciprocal Rank Fusion (RRF)
        # RRF(d) = Σ 1 / (rrf_k + rank_m(d))
        chunk_map: Dict[str, RetrievedChunk] = {}
        rrf_scores: Dict[str, float] = {}

        for item in dense_results:
            chunk_map[item.chunk_id] = item
            rrf_scores[item.chunk_id] = rrf_scores.get(item.chunk_id, 0.0) + (
                1.0 / (rrf_k + (item.dense_rank or candidate_k))
            )

        for item in sparse_results:
            if item.chunk_id not in chunk_map:
                chunk_map[item.chunk_id] = item
            else:
                chunk_map[item.chunk_id].sparse_rank = item.sparse_rank
            rrf_scores[item.chunk_id] = rrf_scores.get(item.chunk_id, 0.0) + (
                1.0 / (rrf_k + (item.sparse_rank or candidate_k))
            )

        # Sort candidate pool by RRF score descending
        sorted_chunk_ids = sorted(
            rrf_scores.keys(),
            key=lambda cid: rrf_scores[cid],
            reverse=True,
        )

        final_chunks: List[RetrievedChunk] = []
        for cid in sorted_chunk_ids[:top_k]:
            chunk = chunk_map[cid]
            chunk.score = round(rrf_scores[cid], 6)
            final_chunks.append(chunk)

        logger.info(
            "Executed Enterprise Hybrid RAG retrieval",
            workspace_id=workspace_id,
            query=cleaned_query,
            dense_candidates=len(dense_results),
            sparse_candidates=len(sparse_results),
            fused_results=len(final_chunks),
        )
        return final_chunks

    def build_grounded_context(
        self,
        chunks: List[RetrievedChunk],
    ) -> GroundedContext:
        """
        Assemble retrieved chunks into structured prompt context with strict citation anchors.
        """
        if not chunks:
            return GroundedContext(context_text="", citations=[], total_chunks=0)

        context_blocks: List[str] = []
        citations: List[Dict[str, Any]] = []

        for idx, chunk in enumerate(chunks, start=1):
            ref_tag = f"source_{idx}"
            page_info = f", Page {chunk.page_number}" if chunk.page_number else ""
            sec_info = f", Section: {chunk.section_header}" if chunk.section_header else ""

            header = f"[Source {idx}: {chunk.filename}{page_info}{sec_info}]"
            block = f"{header}\n{chunk.content.strip()}"
            context_blocks.append(block)

            citations.append(
                {
                    "ref_index": idx,
                    "ref_tag": ref_tag,
                    "chunk_id": chunk.chunk_id,
                    "file_id": chunk.file_id,
                    "filename": chunk.filename,
                    "page_number": chunk.page_number,
                    "section_header": chunk.section_header,
                    "score": chunk.score,
                    "snippet": chunk.content[:200].strip(),
                }
            )

        full_context_text = "\n\n---\n\n".join(context_blocks)
        return GroundedContext(
            context_text=full_context_text,
            citations=citations,
            total_chunks=len(chunks),
        )


# Global singleton instance
rag_service = RAGService()
