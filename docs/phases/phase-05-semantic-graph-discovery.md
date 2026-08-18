# Phase 5: Semantic Graph & Automated Knowledge Discovery

**Estimated Timeline:** 3 – 4 Weeks (~40 – 50 Engineering Hours @ 2 hrs/day)  
**Status:** Planned  
**Goal:** Integrate `pgvector` embeddings, background concept extraction, semantic hybrid search, and automated cross-branch relationship discovery.

---

## 1. Executive Summary

In Phase 5, GraphMind evolves from a visual chat tree into an intelligent, semantic knowledge graph. As you chat, the system asynchronously extracts key technical concepts, generates vector embeddings, enables semantic search across past conversations, and discovers hidden relationships between separate research branches.

---

## 2. Semantic Extraction & Discovery Pipeline

```
[ AI Response Generated ]
            │
            ▼ (Background Event)
[ Concept & Entity Extractor ] ──► Extracts: ["FastAPI", "Dependency Injection", "Pydantic"]
            │
            ├───► Embeds via Embedding Model ──► Saves in pgvector
            │
            └───► Searches Vector Space for Nearest Neighbors in Other Branches
                        │
                        ▼ (Similarity > 0.85)
            [ Suggested Cross-Link Pill: "Related to Docker Compose in 'Deployment' Branch" ]
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 5.1: Vector Storage & Embedding Pipeline (`pgvector`)
*Estimated Time: 4 – 5 Days*

- [ ] **Task 5.1.1 — pgvector Extension Setup**: Enable `pgvector` in PostgreSQL and add vector column to `nodes` table (`embedding: Vector(1536)`).
- [ ] **Task 5.1.2 — Embedding Provider Interface**: Add `BaseEmbeddingProvider` to `packages/ai-core` with OpenAI `text-embedding-3-small` implementation and mock provider.
- [ ] **Task 5.1.3 — Async Embedding Ingestion**: Background worker (Celery/Arq/FastAPI BackgroundTasks) computing and caching embeddings on node creation.

### Sub-Phase 5.2: Automated Concept & Entity Extraction
*Estimated Time: 5 – 6 Days*

- [ ] **Task 5.2.1 — Concept Extraction Prompting**: Structured JSON extraction model identifying key technical terms, libraries, design patterns, and prerequisites.
- [ ] **Task 5.2.2 — Tagging Engine**: Tag database entities (`tags`, `node_tags`) and visual badge rendering on node cards.
- [ ] **Task 5.2.3 — Concept Auto-Completion**: When typing in chat, suggest existing graph concepts for quick referencing.

### Sub-Phase 5.3: Semantic & Hybrid Search API
*Estimated Time: 4 – 5 Days*

- [ ] **Task 5.3.1 — Cosine Similarity Queries**: Implement SQL vector similarity search (`<=>` operator) with HNSW indexing for sub-millisecond retrieval.
- [ ] **Task 5.3.2 — Hybrid Search (BM25 Keyword + Vector)**: Combine PostgreSQL full-text search (`tsvector`) with vector embeddings via Reciprocal Rank Fusion (RRF).
- [ ] **Task 5.3.3 — Search UI Modal (`Cmd+P`)**: Fast search modal highlighting matching nodes and auto-zooming the canvas to the selected result.

### Sub-Phase 5.4: Cross-Branch Relationship Discovery
*Estimated Time: 5 – 6 Days*

- [ ] **Task 5.4.1 — Nearest Neighbor Link Discovery**: Background analysis detecting when a newly created node is semantically related to an existing node in another branch.
- [ ] **Task 5.4.2 — Suggested Edges (UI)**: Dotted suggestion edges rendered between related nodes with a "Confirm Connection" / "Dismiss" pill.
- [ ] **Task 5.4.3 — Relationship Types**: Categorize edges by relation type (`builds_on`, `implements`, `contrasts_with`, `prerequisite_for`).

---

## 4. Exit & Acceptance Criteria

1. Every generated node automatically extracts 2–5 relevant technical tags and stores a vector embedding.
2. Users can search the entire workspace using natural language queries and immediately locate relevant nodes.
3. System suggests valid cross-branch connections when related topics are discussed in separate branches.
4. HNSW index ensures search responses return in $<50\text{ ms}$.
