import pytest
from database import get_session_factory
from models.workspace import Workspace, WorkspaceFile, WorkspaceFileChunk
from services.rag_service import RAGService


@pytest.mark.asyncio
async def test_rag_hybrid_search_and_grounded_context() -> None:
    session_factory = get_session_factory()
    rag = RAGService(provider_name="mock")

    async with session_factory() as session:
        # 1. Create Workspace
        ws = Workspace(name="RAG Test Workspace")
        session.add(ws)
        await session.flush()

        try:
            # 2. Add two files
            file_a = WorkspaceFile(
                workspace_id=ws.id,
                name="raft_consensus.pdf",
                mime_type="application/pdf",
                file_category="document",
                storage_path="/tmp/raft.pdf",
                size_bytes=4000,
            )
            file_b = WorkspaceFile(
                workspace_id=ws.id,
                name="database_internals.md",
                mime_type="text/markdown",
                file_category="document",
                storage_path="/tmp/db.md",
                size_bytes=3500,
            )
            session.add_all([file_a, file_b])
            await session.flush()

            # 3. Add chunks for File A
            chunk_a1 = WorkspaceFileChunk(
                workspace_id=ws.id,
                file_id=file_a.id,
                chunk_index=0,
                content="Raft uses randomized heartbeat timers for leader election.",
                enriched_content="[Document: raft_consensus.pdf | Section: Election | Page 3]\n\nRaft uses randomized heartbeat timers for leader election.",
                page_number=3,
                section_header="Election",
                token_count=12,
                embedding=[0.05] * 768,
            )
            chunk_a2 = WorkspaceFileChunk(
                workspace_id=ws.id,
                file_id=file_a.id,
                chunk_index=1,
                content="Log entries are committed only after quorum majority acknowledgement.",
                enriched_content="[Document: raft_consensus.pdf | Section: Replication | Page 5]\n\nLog entries are committed only after quorum majority acknowledgement.",
                page_number=5,
                section_header="Replication",
                token_count=14,
                embedding=[0.08] * 768,
            )

            # Chunks for File B
            chunk_b1 = WorkspaceFileChunk(
                workspace_id=ws.id,
                file_id=file_b.id,
                chunk_index=0,
                content="LSM trees write to an in-memory memtable before flushing to SSTables on disk.",
                enriched_content="[Document: database_internals.md | Section: Storage Engines]\n\nLSM trees write to an in-memory memtable before flushing to SSTables on disk.",
                section_header="Storage Engines",
                token_count=16,
                embedding=[0.02] * 768,
            )

            session.add_all([chunk_a1, chunk_a2, chunk_b1])
            await session.commit()

            # 4. Search across entire workspace
            results = await rag.hybrid_search(
                db=session,
                workspace_id=ws.id,
                query="randomized heartbeat timers",
                top_k=2,
            )
            assert len(results) >= 1
            top_hit = results[0]
            assert top_hit.filename == "raft_consensus.pdf"
            assert "heartbeat" in top_hit.content
            assert top_hit.score > 0.0

            # 5. Search with file scoping (only database_internals.md)
            scoped_results = await rag.hybrid_search(
                db=session,
                workspace_id=ws.id,
                query="memtable and SSTables",
                file_ids=[file_b.id],
                top_k=5,
            )
            assert len(scoped_results) >= 1
            assert all(r.file_id == file_b.id for r in scoped_results)
            assert scoped_results[0].section_header == "Storage Engines"

            # 6. Build grounded context & verify citations structure
            grounded = rag.build_grounded_context(results)
            assert grounded.total_chunks == len(results)
            assert "[Source 1: raft_consensus.pdf" in grounded.context_text
            assert len(grounded.citations) == len(results)
            assert grounded.citations[0]["page_number"] in (3, 5)
            assert grounded.citations[0]["filename"] == "raft_consensus.pdf"

        finally:
            # Clean up workspace (cascades files & chunks)
            await session.delete(ws)
            await session.commit()
