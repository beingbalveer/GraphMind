# System Architecture — GraphMind

---

## 1. Architectural Principles & Overview

GraphMind is designed as a **Modular Monolith** housed within a monorepo. It prioritizes simplicity, clean separation of concerns, high observability, strict interface boundaries, and progressive knowledge evolution.

```mermaid
graph TD
    Client["Frontend (Next.js 15 App Router / React Flow v12)"] -->|REST / SSE Streaming| API["Backend API (FastAPI)"]
    API -->|Async ORM / SQL| DB[("PostgreSQL 16 + pgvector")]
    API -->|File Storage / Binary Assets| FS[("Workspace Files Storage")]
    API -->|Tool Execution Engine| Tools["Autonomous Graph Tools & Web Grounding"]
    API -->|Curator & Evolution Engine| Curator["Curator Service (DAG Ontology & Gaps)"]
    API -->|Internal Dependency| AICore["packages/ai-core"]
    AICore -->|Provider Interface| Gemini["Google Gemini API"]
    AICore -->|Provider Interface| Anthropic["Anthropic Claude API"]
    AICore -->|Provider Interface| OpenAI["OpenAI API"]
    AICore -->|Provider Interface| DeepSeek["DeepSeek API"]
    AICore -->|Provider Interface| Ollama["Local Ollama"]
```

---

## 2. Monorepo Repository Structure

```
GraphMind/
├── apps/
│   ├── web/                    # Next.js 15 App Router Frontend (TypeScript, React Flow, Zustand)
│   │   ├── src/app/            # Canonical routes: /w/[workspaceId]/chat/[chatId] and /canvas
│   │   ├── src/components/     # Canvas, Chat, PDF/Code/Table Modals, UI library
│   │   └── src/store/          # Zustand client stores (chat, canvas, settings)
│   └── api/                    # FastAPI Backend (Python 3.12+, uv package manager)
│       ├── skills/             # Declarative system skills (Code Architect, Deep Research, Quiz Master)
│       └── src/
│           ├── routers/        # FastAPI endpoints: workspaces, chat, files, mastery, curator
│           ├── services/       # Tool engine, graph tools, file parsing, semantic search, curator
│           └── models/         # SQLAlchemy ORM models (Workspace, Node, Edge, File, Chunk, Concept)
├── packages/
│   ├── ai-core/                # Provider-agnostic LLM, embedding, tool, and skill abstractions
│   └── shared/                 # Shared TypeScript types, schemas, and API contracts
├── docs/                       # System documentation, PRD, Manifesto, ADRs, Roadmap
├── docker-compose.yml          # PostgreSQL 16 (pgvector), Redis, and service containerization
├── pnpm-workspace.yaml         # Workspace configuration for JS/TS packages
├── pyproject.toml              # Python root workspace configuration (uv)
└── README.md
```

---

## 3. Component Details & Technology Stack

### 3.1 Frontend (`apps/web`)
- **Framework**: Next.js 15 (App Router with canonical URL hierarchy `/w/[workspaceId]/chat/[chatId]`).
- **Language**: TypeScript (strict mode enabled).
- **State Management**:
  - `Zustand`: Client-side state (canvas graph nodes, active selection, viewport, active tools).
- **Graph Visualization**: `React Flow` (`@xyflow/react` v12) for 2D canvas, custom nodes (`ThreadGraphNode`), custom bezier/mindmap edges (`MindMapEdge`), Dagre hierarchical auto-layout, and Timeline Replay scrubber.
- **Multimodal Viewers**:
  - `PdfViewerModal`: In-page multi-page PDF reader.
  - `CodeViewerModal`: Syntax-highlighted code viewer.
  - `TableViewerModal`: Interactive tabular grid for CSV, TSV, JSONL, and Excel (`.xlsx`) datasets.
- **Mastery Overlays**:
  - `MasteryPanel`: Interactive sheet presenting concept mastery progress, detected knowledge gaps, and next best topic recommendations.
  - `Heatmap Overlay`: Real-time node illumination based on user mastery levels (`mastered`, `quizzed`, `explored`, `stale`).
- **Styling & UI**: Tailwind CSS v4 + `shadcn/ui` (Radix primitives), minimal clean aesthetic.
- **Markdown & Math**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex` (KaTeX), `rehype-highlight`.

### 3.2 Backend (`apps/api`)
- **Language**: Python 3.12+ (managed with `uv`).
- **Framework**: FastAPI (async routes, automatic OpenAPI documentation, Pydantic v2 validation).
- **Database & ORM**: SQLAlchemy 2.0 (asyncpg) with composite indices for sub-10ms queries.
- **Database Engine**: PostgreSQL 16 with `pgvector` extension (HNSW vector indices for dense embeddings).
- **Hybrid RAG Engine**: Dual retrieval combining dense vector similarity with PostgreSQL full-text search (`to_tsvector` / GIN index) and Reciprocal Rank Fusion (RRF).
- **Autonomous Tool Runtime**: Multi-turn autonomous tool execution loop with SSE streaming (`tool_service.py`) and graph-native grounding tools (`graph_tools.py`).
- **Skills Loader**: Markdown-defined system skills with YAML frontmatter (`skill_service.py`).
- **Knowledge Curator Engine**: Domain ontology DAG modeling, prerequisite gap analysis, forward frontier scoring, and timeline evolution reconstruction (`curator_service.py`).

### 3.3 AI Core Layer (`packages/ai-core`)
`packages/ai-core` is an internal Python package that abstracts all foundation model providers, vector embeddings, and tool definitions.

- **Strict Isolation Rule**: `apps/api` **never** imports `openai`, `anthropic`, or `google-genai` directly. It only imports from `ai_core`.
- **Abstractions**:
  - `BaseProvider`: Abstract base class specifying `generate()`, `stream()`, and `stream_with_tools()`.
  - `BaseEmbeddingProvider`: Vector embedding interface implemented for OpenAI and Gemini.
  - `BaseTool`, `ToolCall`, `ToolResult`: Pydantic tool schemas and execution protocol.
  - `Skill`: Declarative markdown skill parser with metadata frontmatter.
  - `Lineage`: Token-budgeted ancestor traversal algorithms ($O(N)$ with cycle prevention).

---

## 4. Data Model & Database Schema

The graph structure, technical mastery profile, and workspace assets are stored relationally in PostgreSQL:

```mermaid
erDiagram
    WORKSPACES ||--o{ NODES : contains
    WORKSPACES ||--o{ EDGES : contains
    WORKSPACES ||--o{ WORKSPACE_FILES : contains
    WORKSPACES ||--o{ WORKSPACE_CONCEPTS : tracks
    WORKSPACE_FILES ||--o{ WORKSPACE_FILE_CHUNKS : chunks
    NODES ||--o{ EDGES : source_or_target
    NODES ||--o{ NODES : parent_child
    NODES }o--o{ WORKSPACE_CONCEPTS : node_concepts

    WORKSPACES {
        string id PK
        string name
        text description
        float viewport_x
        float viewport_y
        float zoom
        datetime created_at
        datetime updated_at
    }

    NODES {
        string id PK
        string workspace_id FK
        string parent_id FK
        string role
        text content
        text highlighted_context
        string provider
        string model
        float position_x
        float position_y
        jsonb metadata
        vector embedding
        datetime created_at
        datetime updated_at
    }

    EDGES {
        string id PK
        string workspace_id FK
        string source_id FK
        string target_id FK
        string relation_type
        text highlighted_context
        datetime created_at
    }

    WORKSPACE_CONCEPTS {
        string id PK
        string workspace_id FK
        string name
        text description
        string mastery_level
        float confidence_score
        int times_quizzed
        int times_correct
        datetime last_reviewed_at
        vector embedding
        jsonb metadata
        datetime created_at
        datetime updated_at
    }

    WORKSPACE_FILES {
        string id PK
        string workspace_id FK
        string name
        int size_bytes
        string mime_type
        string file_category
        string storage_path
        text extracted_text
        jsonb metadata
        datetime created_at
    }

    WORKSPACE_FILE_CHUNKS {
        string id PK
        string workspace_id FK
        string file_id FK
        int chunk_index
        text content
        text enriched_content
        int page_number
        string section_header
        int token_count
        vector embedding
        datetime created_at
    }
```

---

## 5. End-to-End Sequences

### 5.1 Prompt to Branch Node Creation
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Canvas as React Flow (Client)
    participant API as FastAPI (Server)
    participant AICore as AI Core Package
    participant LLM as Provider API (Gemini / Claude / OpenAI)
    participant DB as PostgreSQL

    User->>Canvas: Selects text in Node A & types Sub-prompt
    Canvas->>API: POST /api/v1/chat/stream (parent_id, highlighted_context, prompt)
    API->>DB: Persist User Prompt Node (Node B)
    API->>AICore: Build lineage context & stream response
    AICore->>LLM: Stream API Request
    LLM-->>AICore: Token Stream
    AICore-->>API: Yield Stream Chunks
    API-->>Canvas: Server-Sent Events (SSE Token Stream)
    Canvas->>Canvas: Render streaming Response Node C & Edge (Node A -> Node C)
    API->>DB: Persist Final Response Node C & Edge upon stream end
```

### 5.2 Autonomous Tool Calling & Grounding Loop
```mermaid
sequenceDiagram
    autonumber
    participant Client as Web Client (SSE)
    participant API as FastAPI Chat Stream
    participant Engine as Tool Execution Engine
    participant LLM as Provider API
    participant Tools as Graph Tools / Web Search

    Client->>API: POST /api/v1/chat/stream (query requiring graph or web data)
    API->>LLM: Stream request with registered tools
    LLM-->>API: ToolCall request (e.g. search_graph or search_web_grounding)
    API-->>Client: SSE event: tool_call
    API->>Engine: Execute requested tool
    Engine->>Tools: Run tool logic
    Tools-->>Engine: Structured ToolResult
    API-->>Client: SSE event: tool_result
    API->>LLM: Feed ToolResult back to model
    LLM-->>API: Synthesized final answer tokens
    API-->>Client: SSE token stream & completed message
```

### 5.3 Knowledge Evolution & Spaced Repetition Feedback Loop
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Mastery Panel / Quiz Card
    participant API as FastAPI Curator & Mastery Router
    participant Curator as Knowledge Curator Engine
    participant DB as PostgreSQL (Concepts & DAG)

    User->>UI: Opens Curator Panel or requests Quiz
    UI->>API: GET /workspaces/{id}/curator/gaps
    API->>Curator: Run Gap Analysis against Domain Dependency DAG
    Curator->>DB: Query explored concepts & confidence scores
    Curator-->>UI: Return detected gaps (e.g. missing Event Loops prerequisite)
    User->>UI: Completes Quiz question on Event Loops
    UI->>API: PATCH /workspaces/{id}/concepts/{id} (quiz_result=True)
    API->>DB: Increment times_quizzed, times_correct & update confidence_score
    API->>DB: Transition mastery_level ('explored' -> 'quizzed' -> 'mastered')
    API-->>UI: Updated mastery state
    UI->>UI: Dispatch 'concept-mastery-updated' & refresh Heatmap
```

---

## 6. Observability, Logging & Deployment

- **Containerization**: `docker-compose.yml` provides PostgreSQL 16 (`pgvector`) and Redis for local developer onboarding and CI/CD.
- **Log Format**: Structured JSON logs via Python `structlog` in the backend with correlation IDs (`RequestTracingMiddleware`).
- **Configuration**: Strictly validated through Pydantic `BaseSettings` reading `.env` files.
- **Performance Profiling**: Sub-10ms HNSW vector searches, sub-5ms tree lineage queries, and single-pass memoized React Flow layouts scaling to 500+ nodes.

---

## 7. Architectural Decisions Log

Key architectural decisions are preserved below for historical context and design governance:

### ADR-0001: Product Identity & Interaction Model
- **Decision:** Shift the fundamental unit of interaction from ephemeral linear chat messages to a multi-dimensional, branching knowledge graph (nodes and edges).
- **Rationale:** Human cognition operates in associative networks rather than flat linear stacks. Traditional chat causes context degradation and buried provenance when exploring tangents. GraphMind keeps original context visible and navigable.

### ADR-0002: Modular Monolith Monorepo Architecture
- **Decision:** Structure GraphMind as a modular monolith monorepo (`apps/web`, `apps/api`, `packages/ai-core`, `packages/shared`) managed with `pnpm` and `uv`.
- **Rationale:** Avoids premature microservice operational overhead (service discovery, distributed tracing, network latency) while maintaining strict package boundaries, fast local development via Docker Compose, and shared TypeScript/Python contracts.

### ADR-0003: AI Provider Abstraction (`packages/ai-core`)
- **Decision:** Strictly isolate foundation model providers behind an internal abstraction package (`packages/ai-core`).
- **Rationale:** Foundation model APIs and vendor SDKs (Gemini, Anthropic, OpenAI, DeepSeek, Ollama) change frequently. Enforcing that `apps/api` never directly imports external vendor libraries prevents lock-in, enables seamless model switching, and simplifies deterministic mock testing.

### ADR-0004: Selection of Apache License 2.0
- **Decision:** Publish GraphMind under the Apache License 2.0.
- **Rationale:** Apache 2.0 provides permissive open-source usage while including explicit patent grants and contributor protections, making it ideal for both developer adoption and enterprise deployment.

### ADR-0005: Milestone-Driven Execution Strategy
- **Decision:** Adopt a progressive, milestone-driven development strategy with a zero dead UI policy and strict phase completion gates.
- **Rationale:** Prevents scope creep, premature mock buttons, and unfinished architectural churn. Every milestone produces an observable, fully tested, production-grade slice of the system.

