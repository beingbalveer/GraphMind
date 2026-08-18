# GraphMind — Master Evolutionary Roadmap & Phase Specifications

> **Philosophy:** *Progressive, organic growth without dead UI or prototype hacks.* Every phase delivers a fully functional, production-grade release that naturally extends the previous phase.

---

## 1. Master Timeline Summary

Assuming a focused pace of **~2 hours/day** (approx. **10 – 14 engineering hours/week**), here is the realistic timeline to build the entire production-grade platform:

| Phase | Phase Name | Focus & Core Deliverable | Estimated Time | Spec Document |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | **Production Core & Streamed Chat** | Provider-agnostic AI Core, FastAPI SSE streaming, Next.js UI shell, Markdown + KaTeX, unit & E2E tests. | **2 – 3 Weeks** (~35 hrs) | [`phase-01-core-chat-engine.md`](./phases/phase-01-core-chat-engine.md) |
| **Phase 2** | **Tree-Structured Branching** | Hierarchical conversation tree, text-highlight branching trigger, context lineage traversal engine. | **2 – 3 Weeks** (~30 hrs) | [`phase-02-tree-branching.md`](./phases/phase-02-tree-branching.md) |
| **Phase 3** | **Spatial Graph Canvas** | 2D React Flow canvas, node cards, Dagre auto-layout, canvas + Focus Drawer dual UX, keyboard shortcuts. | **3 – 4 Weeks** (~45 hrs) | [`phase-03-spatial-graph-canvas.md`](./phases/phase-03-spatial-graph-canvas.md) |
| **Phase 4** | **Workspace Persistence** | PostgreSQL + async SQLAlchemy, Alembic migrations, auth/JWT, auto-save debouncing, Obsidian markdown export. | **2 – 3 Weeks** (~35 hrs) | [`phase-04-persistence-workspaces.md`](./phases/phase-04-persistence-workspaces.md) |
| **Phase 5** | **Semantic Graph & Discovery** | `pgvector` embeddings, background concept extraction, hybrid BM25+vector search, suggested cross-branch links. | **3 – 4 Weeks** (~45 hrs) | [`phase-05-semantic-graph-discovery.md`](./phases/phase-05-semantic-graph-discovery.md) |
| **Phase 6** | **Knowledge Evolution & Agents** | Multi-agent runtime (Research, Quiz, Summarizer), user mastery modeling, Knowledge Curator, v1.0 release. | **4 – 5 Weeks** (~55 hrs) | [`phase-06-multi-agent-knowledge-evolution.md`](./phases/phase-06-multi-agent-knowledge-evolution.md) |

**Total Estimated Duration:** **16 – 22 Weeks** (~4 to 5.5 Months) of structured, production-grade engineering.

---

## 2. Master Gantt Progression

```mermaid
gantt
    title GraphMind Progressive Evolution Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  Week %W
    
    section Phase 1: Core Streamed Chat
    Monorepo & Scaffolding            :p1_1, 2026-08-18, 4d
    AI Core & Provider Abstraction     :p1_2, after p1_1, 4d
    FastAPI SSE Chat Engine           :p1_3, after p1_2, 5d
    Next.js UI Shell & Markdown       :p1_4, after p1_3, 5d
    Testing & Phase 1 Signoff         :p1_5, after p1_4, 3d

    section Phase 2: Tree Branching
    Tree Data Structures & Schemas    :p2_1, after p1_5, 4d
    Lineage Context Traversal Engine   :p2_2, after p2_1, 5d
    Highlight & Branching Action      :p2_3, after p2_2, 5d
    Navigation & Branch State         :p2_4, after p2_3, 4d

    section Phase 3: Spatial Canvas
    React Flow Canvas Foundation      :p3_1, after p2_4, 5d
    Custom Node & Edge Cards          :p3_2, after p3_1, 6d
    Dagre / ELK Auto-Layout Engine    :p3_3, after p3_2, 5d
    Focus Drawer & Dual-Mode UX       :p3_4, after p3_3, 6d

    section Phase 4: Persistence
    PostgreSQL Async & ORM Models     :p4_1, after p3_4, 5d
    Workspace CRUD & Delta Auto-Save  :p4_2, after p4_1, 5d
    Auth & Obsidian Markdown Export   :p4_3, after p4_2, 5d

    section Phase 5: Semantic Graph
    pgvector & Embedding Pipeline     :p5_1, after p4_3, 5d
    Concept & Entity Auto-Extractor   :p5_2, after p5_1, 6d
    Hybrid Search & Cross-Link Engine :p5_3, after p5_2, 6d

    section Phase 6: Knowledge Evolution
    Agent Runtime & Specialized Agents:p6_1, after p5_3, 8d
    Mastery Heatmap & Gap Analysis    :p6_2, after p6_1, 8d
    Knowledge Curator & v1.0 Launch   :p6_3, after p6_2, 6d
```

---

## 3. Phase Specifications Index

Read each dedicated specification file for in-depth technical tasks, data flows, and acceptance criteria:

1. [**Phase 1: Production Core & Streamed Chat Engine**](./phases/phase-01-core-chat-engine.md)
2. [**Phase 2: Tree-Structured Branching & Lineage Engine**](./phases/phase-02-tree-branching.md)
3. [**Phase 3: The Spatial Graph Canvas (2D Visual Workspace)**](./phases/phase-03-spatial-graph-canvas.md)
4. [**Phase 4: Workspace Persistence & Relational Storage**](./phases/phase-04-persistence-workspaces.md)
5. [**Phase 5: Semantic Graph & Automated Knowledge Discovery**](./phases/phase-05-semantic-graph-discovery.md)
6. [**Phase 6: Multi-Agent Workflows & Knowledge Evolution**](./phases/phase-06-multi-agent-knowledge-evolution.md)
