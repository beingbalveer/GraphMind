# Phase 5: Semantic Graph & Automated Knowledge Discovery

**Estimated Timeline:** 3 – 4 Weeks (~40 – 50 Engineering Hours @ 2 hrs/day)  
**Status:** Completed ✅ (Vector & Asset Foundation)  
**Goal:** Integrate `pgvector` embeddings, multimodal file ingestion, semantic search, and autonomous graph exploration tools.

---

## 1. Executive Summary

In Phase 5, GraphMind evolves from a visual chat tree into an intelligent, semantic knowledge graph. As you chat, the system asynchronously extracts key technical concepts, generates dense vector embeddings, enables semantic search across past conversations, and provides a rich multimodal file library with dedicated in-app viewers.

---

## 2. Semantic Extraction & Discovery Pipeline

```
[ AI Response Generated / File Uploaded ]
            │
            ▼ (Background Event)
[ Concept & File Extractor ] ──► Extracts text, tags, and tabular schemas
            │
            ├───► Embeds via Embedding Model ──► Saves in pgvector (768-dim)
            │
            └───► Searches Vector Space for Nearest Neighbors across Nodes
                        │
                        ▼
            [ Autonomous Graph Grounding & Search: search_graph ]
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 5.1: Vector Storage & Embedding Pipeline (`pgvector`)
*Estimated Time: 4 – 5 Days*

- [x] **Task 5.1.1 — pgvector Extension Setup**: Enable `pgvector` in PostgreSQL and add vector column to `nodes` table (`embedding: Vector(768)`).
- [x] **Task 5.1.2 — Embedding Provider Interface**: Add `BaseEmbeddingProvider` to `packages/ai-core` with OpenAI, Gemini, and Mock implementations.
- [x] **Task 5.1.3 — Embedding Service & Ingestion**: Background computation and caching of embeddings on node creation (`semantic_service.py`).

### Sub-Phase 5.2: Multimodal Asset Library & Document Parsing
*Estimated Time: 5 – 6 Days*

- [x] **Task 5.2.1 — Workspace Asset Store**: `workspace_files` relational model for managing PDFs, code, spreadsheets, and images.
- [x] **Task 5.2.2 — Multimodal Ingestion Pipeline**: Document parsing (`pypdf` for PDFs, `openpyxl`/`csv` for tables) and inline multimodal context injection for Gemini/Claude.
- [x] **Task 5.2.3 — In-App Viewers**: Dedicated modal viewers for PDF (`PdfViewerModal`), Code (`CodeViewerModal`), and Tabular datasets (`TableViewerModal`).

### Sub-Phase 5.3: Semantic & Hybrid Search API
*Estimated Time: 4 – 5 Days*

- [x] **Task 5.3.1 — Cosine Similarity Queries**: Implement SQL vector similarity search with `pgvector` (`semantic_service.py`).
- [x] **Task 5.3.2 — Graph Search Tool**: Autonomous tool `search_graph` enabling models to retrieve workspace nodes.
- [x] **Task 5.3.3 — Command Palette & Fast Navigation (`Cmd+K`)**: Quick jump modal across all canvas nodes.

### Sub-Phase 5.4: Cross-Branch Relationship Discovery
*Estimated Time: 5 – 6 Days*

- [x] **Task 5.4.1 — Nearest Neighbor Link Discovery**: Find related nodes across distinct conversation branches.
- [ ] **Task 5.4.2 — Automated Suggestion Pills (UI)**: Dotted suggestion edges rendered between related nodes with confirmation flow.
- [ ] **Task 5.4.3 — Typed Relationship Classification**: Automatic categorization (`builds_on`, `implements`, `contrasts_with`).

---

## 4. Exit & Acceptance Criteria

1. Every generated node automatically extracts 2–5 relevant technical tags and stores a vector embedding.
2. Users can search the entire workspace using natural language queries and immediately locate relevant nodes.
3. System suggests valid cross-branch connections when related topics are discussed in separate branches.
4. HNSW index ensures search responses return in $<50\text{ ms}$.
