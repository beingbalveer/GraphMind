from services.chunking_service import (
    ChunkingService,
    estimate_token_count,
)


def test_estimate_token_count() -> None:
    text = "This is a simple sentence testing token estimation."
    tokens = estimate_token_count(text)
    assert tokens >= 7


def test_chunk_markdown_headings() -> None:
    service = ChunkingService(target_chunk_tokens=50, chunk_overlap_tokens=10)
    md_content = """# System Architecture

GraphMind combines React Flow with FastAPI and PostgreSQL pgvector.

## Ingestion Pipeline

The ingestion pipeline parses files, extracts text, and generates enriched chunks.
Every chunk includes hierarchical context breadcrumbs.

### Vector Storage

Dense vectors are indexed using HNSW for sub-50ms cosine similarity.
"""
    chunks = service.chunk_document(
        filename="architecture.md",
        content=md_content,
        file_category="markdown",
    )

    assert len(chunks) >= 3
    # Check that headers are captured
    headers = [c.section_header for c in chunks]
    assert any("System Architecture" in h for h in headers if h)
    assert any("Ingestion Pipeline" in h for h in headers if h)
    assert any("Vector Storage" in h for h in headers if h)

    # Check context enrichment
    first_chunk = chunks[0]
    assert "[Document: architecture.md" in first_chunk.enriched_content
    assert first_chunk.token_count > 0


def test_chunk_pdf_page_preservation() -> None:
    service = ChunkingService(target_chunk_tokens=100, chunk_overlap_tokens=20)
    pdf_text = """--- Page 1 ---
Introduction to Distributed Consensus and Raft algorithm.
Leader election occurs via randomized heartbeat timers.

--- Page 2 ---
Log replication guarantees state machine safety across cluster quorums.
Followers append log entries sequentially.

--- Page 3 ---
Joint consensus reconfiguration allows dynamic cluster membership changes.
"""
    chunks = service.chunk_document(
        filename="raft_paper.pdf",
        content=pdf_text,
        file_category="pdf",
    )

    assert len(chunks) == 3
    assert chunks[0].page_number == 1
    assert "[Document: raft_paper.pdf | Page 1]" in chunks[0].enriched_content
    assert chunks[1].page_number == 2
    assert "[Document: raft_paper.pdf | Page 2]" in chunks[1].enriched_content
    assert chunks[2].page_number == 3
    assert "[Document: raft_paper.pdf | Page 3]" in chunks[2].enriched_content


def test_chunk_code_files() -> None:
    service = ChunkingService(target_chunk_tokens=80, chunk_overlap_tokens=10)
    code_content = """def calculate_loss(predictions, targets):
    return ((predictions - targets) ** 2).mean()

class ModelTrainer:
    def __init__(self, model, optimizer):
        self.model = model
        self.optimizer = optimizer
"""
    chunks = service.chunk_document(
        filename="trainer.py",
        content=code_content,
        file_category="code",
    )

    assert len(chunks) >= 1
    assert any("trainer.py" in c.enriched_content for c in chunks)
    assert any(c.section_header and "def " in c.section_header for c in chunks)


def test_chunk_tabular_data() -> None:
    service = ChunkingService(target_chunk_tokens=100)
    tabular_content = """| Product | Category | Price |
| --- | --- | --- |
| Laptop | Hardware | 1200 |
| Mouse | Hardware | 25 |
| Keyboard | Hardware | 75 |
"""
    chunks = service.chunk_document(
        filename="inventory.csv",
        content=tabular_content,
        file_category="tabular",
    )

    assert len(chunks) >= 1
    assert "[Document: inventory.csv" in chunks[0].enriched_content
    assert "Laptop" in chunks[0].content


def test_split_large_paragraph_by_sentences() -> None:
    service = ChunkingService(target_chunk_tokens=30, chunk_overlap_tokens=5)
    long_para = (
        "First sentence in this paragraph contains important context. "
        "Second sentence adds further technical explanation of the pipeline. "
        "Third sentence discusses performance benchmarks and throughput numbers. "
        "Fourth sentence provides deployment recommendations on Kubernetes clusters."
    )
    chunks = service._split_text_with_overlap(long_para)
    assert len(chunks) > 1
    # Verify continuity
    assert "First sentence" in chunks[0]
    assert "Fourth sentence" in chunks[-1]
