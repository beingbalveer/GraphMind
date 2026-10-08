# GraphMind — Master Evolutionary Roadmap & Milestone Specifications

> **Philosophy:** *Progressive, organic growth without dead UI or prototype hacks.* Every phase delivers a fully functional, production-grade release that naturally extends the previous phase.

---

## 1. Master Timeline & Milestone Status

| Phase | Phase Name | Focus & Core Deliverable | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Production Core & Streamed Chat** | Provider-agnostic AI Core, FastAPI SSE streaming, Next.js UI shell, Markdown + KaTeX. | **Completed** ✅ |
| **Phase 2** | **Tree-Structured Branching** | Hierarchical conversation tree, text-highlight branching trigger, context lineage traversal engine. | **Completed** ✅ |
| **Phase 3** | **Spatial Graph Canvas** | 2D React Flow canvas, node cards, Dagre auto-layout, mindmap layout, LOD, Focus Drawer. | **Completed** ✅ |
| **Phase 4** | **Workspace Persistence** | PostgreSQL + async SQLAlchemy, Alembic migrations, debounced viewport sync, demo workspace seed. | **Completed** ✅ |
| **Phase 5** | **Semantic Graph & Discovery** | `pgvector` embeddings, multimodal file library (PDF, Code, Tables), in-app modal viewers, vector search. | **Completed** ✅ |
| **Phase 6** | **Knowledge Evolution & Agents** | Autonomous tool loop, graph-native tools, web grounding, system skills, knowledge state modeling & curator. | **Completed** ✅ |

---

## 2. Completed Phase Deliverables Summary

### Current delivery: Shared Canvas and Roadmap Generator

Approved [design specification](superpowers/specs/2026-10-07-roadmap-generator-design.md)
and linked [canvas](superpowers/plans/2026-10-07-canvas-redesign.md) /
[roadmap](superpowers/plans/2026-10-07-roadmap-generator.md) implementation plans.
Implementation uses `codex/roadmap-generator`, one verified task and commit at a time.

- **Completed:** Backend test bootstrap now rejects live/implicit database settings;
  seven guard tests pass against a dedicated PostgreSQL test database.
- **Completed:** Stable conversation segments retain actual nested branch origins,
  with guarded cycle traversal and timeline ancestry.
- **Completed:** Approved semantic canvas palette, accessible shared cards and
  measured non-overlapping spine layout.
- **Completed:** Live shared canvas renderer with compact options, source-origin
  connectors, stable streaming/selection placement and independent timeline layout.
- **Completed:** Versioned layout persistence with authenticated membership checks,
  debounced saves, retry/reload recovery and confirmed real drag/refresh behavior.
  Additive migration round trip, frontend typecheck and isolated production build pass.
- **Completed:** Fresh canvas review fixes pending-save navigation loss; 42 focused
  frontend checks pass. See [verification](quality/canvas-redesign-2026-10-07.md).
- **Completed:** Typed curricula, deterministic workload/prerequisite validation,
  durable generation jobs, safe references and grounded search with registered skills.
- **Completed:** Minimal setup, resumable progress/activity and dedicated roadmap /
  canvas learning views with stable identities.
- **Completed:** Guided saved lessons, learner-controlled completion and optional
  knowledge checks; direct editing, revision history and explicit AI proposal review.
- **Active task:** Final research quality evaluations and independent whole-branch
  review. See [current verification](quality/roadmap-generator-2026-10-07.md).

No unfinished future actions are exposed in the application during this delivery.

### Phase 1: Production Core & Streamed Chat Engine
- **AI Core (`packages/ai-core`)**: Provider-agnostic abstractions (`BaseProvider`, `BaseEmbeddingProvider`, `BaseTool`) decoupling business logic from OpenAI, Gemini, Anthropic, DeepSeek, and local Ollama.
- **FastAPI SSE Streaming**: Async Server-Sent Events endpoint (`/api/v1/chat/stream`) with structured event payloads (`token`, `message_start`, `message_end`, `error`).
- **Next.js UI Shell**: Modern App Router chat interface with fluid responsiveness, dark mode, accessible keyboard controls, and token-based theme styling.
- **Rich Content Rendering**: Streaming Markdown support with LaTeX formulas (`rehype-katex`), syntax-highlighted code blocks, and copy-to-clipboard actions.
- **CI/CD & Mocking**: Mock LLM providers enabling deterministic, zero-cost integration tests in CI.

### Phase 2: Tree-Structured Branching & Lineage Engine
- **Tree Schemas**: Relational conversation node hierarchy with parent/child links and branch origin metadata (`ConversationNode`, `TreeEdge`).
- **Lineage Traversal Algorithm**: Token-budgeted ancestor traversal engine ($O(N)$ with cycle prevention) ensuring the LLM receives exact ancestral context without context window overflow.
- **Highlight-to-Branch Trigger**: Contextual popover appearing upon text selection in chat/node cards to branch thoughts immediately.
- **Branch Drawer & Dual-Pane UI**: Split-screen viewing enabling side-by-side exploration of parent thread and child branches.

### Phase 3: Spatial Graph Canvas (2D Visual Workspace)
- **React Flow Integration**: Interactive 2D canvas (`@xyflow/react` v12) supporting infinite pan, smooth zoom (10%–200%), and fluid drag-and-drop.
- **Adaptive Level-of-Detail (LOD)**:
  - *Galaxy View* (<0.6x): High-density circular knowledge orbs with role glyphs and glowing links for bird's-eye spatial navigation.
  - *Topic Capsule View* (0.6x–1.2x): Horizontal topic summaries with avatars and branch quotes.
  - *Detailed View* (>1.2x): Full metadata tags and branch counters.
- **Dagre Auto-Layout**: Single-click hierarchical graph reordering (`⌘L`) resolving node collisions with configurable horizontal/vertical layouts.
- **Focus Reader Drawer**: Slide-out panel for distraction-free reading of complete node content with inline follow-up prompting.

### Phase 4: Workspace Persistence & Relational Storage
- **Async PostgreSQL & SQLAlchemy**: Asyncpg driver, connection pooling, and declarative ORM models (`Workspace`, `Node`, `Edge`, `User`).
- **Alembic Migrations**: Fully managed, reversible database schema migrations.
- **Debounced Auto-Save**: Real-time optimistic UI updates synced to backend with debounced delta persistence.
- **Authentication**: Email/Password with Argon2 hashing, stateless JWT access/refresh tokens, and Google/GitHub OAuth 2.0.
- **Demo Workspace Seeding**: Built-in interactive sample workspaces demonstrating branching and knowledge graphs immediately upon onboarding.

### Phase 5: Semantic Graph & Automated Knowledge Discovery
- **`pgvector` Dense Embeddings**: HNSW vector indices providing sub-10ms semantic similarity queries across conversation nodes.
- **Hybrid Retrieval**: Dense vector search combined with PostgreSQL full-text search (`tsvector` / GIN index) fused via Reciprocal Rank Fusion (RRF).
- **Multimodal File Library**: File attachment pipeline supporting PDF, code files (`.py`, `.ts`, `.rs`, `.go`), CSV, TSV, JSONL, and Excel sheets.
- **Specialized Modal Viewers**: In-app `PdfViewerModal`, `CodeViewerModal`, and virtualized `TableViewerModal`.
- **Automated Concept Extraction**: Background extraction of domain concepts and prerequisites during conversational turns.

### Phase 6: Multi-Agent Workflows & Knowledge Evolution
- **Autonomous Tool Runtime**: Multi-turn autonomous tool execution loop with SSE streaming (`tool_call` and `tool_result` events).
- **Graph-Native Tools & Grounding**: `search_graph`, `fetch_node_lineage`, and live web search grounding.
- **Declarative System Skills**: Markdown-defined AI personas with YAML frontmatter:
  - *Code Architect*: Strict system design, type safety, and software architecture patterns.
  - *Deep Research*: Autonomous multi-step literature gathering and citation grounding.
  - *Quiz Master*: Contextual comprehension questions and interactive score assessment.
- **Knowledge Curator Engine**: Domain ontology DAG modeling prerequisite relationships, identifying missing foundational knowledge gaps, and recommending forward learning frontiers.
- **Mastery Heatmap & Timeline Replay**: Color-coded node illumination (`mastered`, `quizzed`, `explored`, `stale`) and timeline scrubber to visualize learning growth across time.

### Active Superpowers: Node-Linked Flashcards (Feature 2.1)
- **Node-Linked Generation (`/api/v1/workspaces/{workspace_id}/nodes/{node_id}/flashcards`)**: Provider-agnostic LLM extraction generating 1–10 high-retention Q&A flashcards strictly grounded in assistant response content.
- **Relational Persistence**: `flashcards` PostgreSQL table with cascade deletion on workspace and source node, deterministic positions, and Alembic migrations.
- **Review & Edit Modal**: In-app modal interface allowing users to inspect, flip (reveal answers), edit inline (question and answer), delete with confirmation, and regenerate with fresh drafts.
- **Surface Integration**: Integrated into assistant message actions across both linear chat and the canvas side-peek branch sheet.

---

## 3. Future Enterprise Horizon

The following architectural capabilities define GraphMind's enterprise scale-up roadmap:

### 3.1 Real-Time Multiplayer Collaboration
- **CRDT Engine**: Migrate canvas and thread synchronization to Conflict-free Replicated Data Types (using Yjs or Automerge over WebSockets).
- **Live Presence**: Multi-user cursor tracking, active typing indicators, and user avatar badges on canvas nodes.
- **Deterministic Branch Merging**: Conflict-free branch resolution when multiple collaborators prompt from the same node concurrently.

### 3.2 Enterprise Identity, Security & Compliance
- **Enterprise SSO**: SAML 2.0 and OIDC integrations for Google Workspace, Okta, and Microsoft Entra ID.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions (Viewer, Contributor, Editor, Admin) scoped per workspace and branch.
- **Immutable Audit Logging**: Tamper-evident activity logs recording node creation, edits, exports, and permission changes (SOC2/GDPR compliance).
- **Customer-Managed Encryption Keys (CMEK)**: Optional end-to-end envelope encryption using AWS KMS / GCP Cloud KMS for database persistence.

### 3.3 Large-Scale Canvas Virtualization & High Availability
- **Canvas Tile Chunking**: Viewport-based node virtualization allowing smooth 60 FPS rendering on massive workspaces exceeding 10,000+ nodes.
- **Connection Pooling & Read Replicas**: PgBouncer pooling for backend asyncpg connections and read-replica distribution for heavy semantic search queries.
- **Offline-First PWA**: Client-side IndexedDB caching (via Dexie.js) allowing offline graph traversal with automatic sync upon reconnection.

### Researched roadmap workspace — implementation branch

The roadmap generator now has durable researched jobs and a concise setup/progress
flow. The ordered page and shared curriculum canvas read the same immutable
revision, with explicit prerequisite links and selected-core progress. The
operator flag is enabled after the real guided-lesson/progress journey. All fourteen roadmap implementation tasks and five native quality evaluations
are verified. Independent whole-branch review is complete; all four Important findings have
regression coverage and the full verification gates pass (existing whole-backend
mypy failures remain documented separately).
