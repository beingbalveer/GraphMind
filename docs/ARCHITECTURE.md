# System Architecture — GraphMind

---

## 1. Architectural Principles & Overview

GraphMind is designed as a **Modular Monolith** housed within a monorepo. It prioritizes simplicity, clean separation of concerns, high observability, and strict interface boundaries.

```mermaid
graph TD
    Client["Frontend (Next.js 15 App Router / React Flow)"] -->|REST / SSE Streaming| API["Backend API (FastAPI)"]
    API -->|Async ORM / SQL| DB[("PostgreSQL 16 + pgvector")]
    API -->|File Storage / Binary Assets| FS[("Workspace Files Storage")]
    API -->|Tool Execution Engine| Tools["Autonomous Graph Tools & Web Grounding"]
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
│           ├── routers/        # FastAPI endpoints: workspaces, chat, files
│           ├── services/       # Tool engine, graph tools, file parsing, semantic search
│           └── models/         # SQLAlchemy ORM models (Workspace, Node, Edge, File)
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
- **Graph Visualization**: `React Flow` (`@xyflow/react` v12) for 2D canvas, custom nodes (`ThreadGraphNode`), custom bezier/mindmap edges, Dagre hierarchical auto-layout, and radial/horizontal mindmap layout.
- **Multimodal Viewers**:
  - `PdfViewerModal`: In-page multi-page PDF reader.
  - `CodeViewerModal`: Syntax-highlighted code viewer.
  - `TableViewerModal`: Interactive tabular grid for CSV, TSV, JSONL, and Excel (`.xlsx`) datasets.
- **Styling & UI**: Tailwind CSS v4 + `shadcn/ui` (Radix primitives), minimal clean aesthetic.
- **Markdown & Math**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex` (KaTeX), `rehype-highlight`.

### 3.2 Backend (`apps/api`)
- **Language**: Python 3.12+ (managed with `uv`).
- **Framework**: FastAPI (async routes, automatic OpenAPI documentation, Pydantic v2 validation).
- **Database & ORM**: SQLAlchemy 2.0 (asyncpg) + `Alembic` for migrations.
- **Database Engine**: PostgreSQL 16 with `pgvector` extension for vector embeddings.
- **File Asset Management**: Multimodal ingestion with `pypdf` (text extraction) and `openpyxl` / `csv` (tabular parsing).
- **Autonomous Tool Runtime**: Multi-turn autonomous tool execution loop with SSE streaming (`tool_service.py`) and graph-native grounding tools (`graph_tools.py`).
- **Skills Loader**: Markdown-defined system skills (`skill_service.py`).

### 3.3 AI Core Layer (`packages/ai-core`)
`packages/ai-core` is an internal Python package that abstracts all foundation model providers, vector embeddings, and tool definitions.

- **Strict Isolation Rule**: `apps/api` **never** imports `openai`, `anthropic`, or `google-genai` directly. It only imports from `ai_core`.
- **Abstractions**:
  - `BaseProvider`: Abstract base class specifying `generate()`, `stream()`, and `stream_with_tools()`.
  - `BaseEmbeddingProvider`: Vector embedding interface implemented for OpenAI and Gemini.
  - `BaseTool`, `ToolCall`, `ToolResult`: Pydantic tool schemas and execution protocol.
  - `Skill`: Declarative markdown skill parser with metadata frontmatter.
  - `LLMConfig`: Pydantic settings model for model name, temperature, max tokens, system prompts.

---

## 4. Data Model & Database Schema

The graph structure and workspace assets are stored relationally in PostgreSQL:

```mermaid
erDiagram
    WORKSPACES ||--o{ NODES : contains
    WORKSPACES ||--o{ EDGES : contains
    WORKSPACES ||--o{ WORKSPACE_FILES : contains
    NODES ||--o{ EDGES : source_or_target
    NODES ||--o{ NODES : parent_child

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

---

## 6. Observability, Logging & Deployment

- **Containerization**: `docker-compose.yml` provides PostgreSQL 16 (`pgvector`) and Redis for local developer onboarding and CI/CD.
- **Log Format**: JSON formatted logs using Python `structlog` in the backend.
- **Configuration**: All configuration validated via Pydantic `BaseSettings` reading `.env` files.
