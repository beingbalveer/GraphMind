# GraphMind API (`apps/api`)

FastAPI backend application for GraphMind providing high-throughput REST endpoints, Server-Sent Events (SSE) streaming, autonomous tool execution, multimodal file extraction, and PostgreSQL persistence with `pgvector`.

---

## 🏛️ Architecture & Core Responsibilities

The API service is built on Python 3.12+ and FastAPI. It serves as the orchestrator connecting the Next.js frontend with the foundation models in `packages/ai-core`, local vector databases, and file asset storage.

```
apps/api/
├── skills/                     # Markdown-defined system skills
│   ├── code_architect/SKILL.md # Senior architectural persona
│   ├── deep_research/SKILL.md  # Rigorous academic research persona
│   └── quiz_master/SKILL.md    # Knowledge evaluation persona
└── src/
    ├── routers/                # FastAPI endpoint handlers
    │   ├── chat.py             # SSE chat streaming, branching, and autonomous tool loop
    │   ├── workspaces.py       # Workspace CRUD, nodes, edges, viewport sync, import/export
    │   └── files.py            # File uploads, thumbnails, downloads, and multimodal parsing
    ├── services/               # Core business & algorithmic logic
    │   ├── tool_service.py     # Multi-turn autonomous tool execution loop
    │   ├── graph_tools.py      # Graph-native tools (search, traverse, fetch, neighbors, web)
    │   ├── skill_service.py    # Markdown skill parser and prompt composer
    │   ├── file_service.py     # PDF extraction (pypdf), tabular parsing (csv, openpyxl), image handling
    │   ├── semantic_service.py # Vector embeddings & pgvector similarity search
    │   ├── workspace_service.py# Tree lineage traversal and node hierarchy management
    │   └── seed_service.py     # Demo onboarding workspace generator
    ├── models/                 # SQLAlchemy 2.0 async ORM database models
    │   └── workspace.py        # Workspace, NodeModel, EdgeModel, WorkspaceFile
    ├── schemas/                # Pydantic v2 validation models
    ├── database.py             # Async engine, sessionmaker, and Base model
    ├── config.py               # Pydantic BaseSettings environment loader
    └── main.py                 # FastAPI application factory and middleware configuration
```

---

## 📡 API Endpoints Overview

All endpoints are versioned under `/api/v1`:

### 1. Workspaces & Knowledge Graph (`/api/v1/workspaces`)
- `GET /api/v1/workspaces`: List all workspaces.
- `POST /api/v1/workspaces`: Create a new workspace.
- `GET /api/v1/workspaces/{id}`: Fetch complete workspace data (nodes, edges, files, viewport).
- `PATCH /api/v1/workspaces/{id}`: Update metadata (title, description).
- `DELETE /api/v1/workspaces/{id}`: Cascade-delete workspace and all associated resources.
- `PUT /api/v1/workspaces/{id}/viewport`: Auto-save debounced canvas pan coordinates and zoom level.
- `PATCH /api/v1/workspaces/{id}/nodes/{node_id}/position`: Update spatial coordinates of a node card.
- `POST /api/v1/workspaces/{id}/export`: Export entire knowledge graph to JSON.
- `POST /api/v1/workspaces/{id}/seed`: Populate an interactive demo workspace with sample branches.

### 2. Streaming Chat & Tool Execution (`/api/v1/chat`)
- `POST /api/v1/chat/stream`: Initiates an SSE (Server-Sent Events) stream for:
  - Standard conversation responses.
  - Text-selection branch responses (spawning sub-threads with inherited context lineage).
  - Autonomous multi-step tool calls and execution results (`tool_call`, `tool_result`, and final answer).
- `GET /api/v1/chat/skills`: List all available system skills loaded from `apps/api/skills/`.

### 3. File Library & Multimodal Ingestion (`/api/v1/files`)
- `POST /api/v1/files/upload`: Upload asset to workspace library (PDF, images, spreadsheets, code).
- `GET /api/v1/files/{file_id}`: Retrieve file metadata and extracted textual content.
- `GET /api/v1/files/{file_id}/raw`: Serve binary file stream (inline preview or download attachment).
- `DELETE /api/v1/files/{file_id}`: Delete file from library and disk storage.

---

## 🛠️ Autonomous Tool Execution & Graph Grounding

GraphMind equips models with graph-native tools defined in `services/graph_tools.py` and executed via `services/tool_service.py`:

| Tool Name | Parameters | Purpose |
| :--- | :--- | :--- |
| `search_graph` | `query: str` | Semantic & keyword search across all workspace nodes. |
| `fetch_node_details` | `node_id: str` | Retrieve full content, parentage, and metadata of a node. |
| `get_node_neighbors` | `node_id: str` | Inspect incoming and outgoing relationship edges. |
| `traverse_branch_lineage` | `node_id: str` | Trace the full ancestry path from root to node. |
| `search_web_grounding` | `query: str` | Fetch live web search results and external citations via DuckDuckGo. |

Tool events are streamed in real time to the frontend:
```json
// SSE event: tool_call
{"event": "tool_call", "data": {"name": "fetch_node_details", "arguments": {"node_id": "node_abc123"}}}

// SSE event: tool_result
{"event": "tool_result", "data": {"name": "fetch_node_details", "result": "..."}}
```

---

## ⚙️ Configuration & Environment Variables

Configuration is validated via Pydantic `BaseSettings` in `src/config.py`. Set these in `apps/api/.env`:

```env
# Database Connection
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/graphmind

# AI Provider Selection (gemini, openai, anthropic, deepseek, ollama, mock)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash

# Foundation Model API Keys
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Storage Paths
FILE_STORAGE_DIR=data/storage

# CORS Settings
CORS_ORIGINS=["http://localhost:3300"]
```

---

## 🚀 Local Development

### 1. Run Database Migrations
```bash
uv run alembic upgrade head
```

### 2. Start Backend Server
```bash
uv run uvicorn --app-dir src main:app --port 8300 --reload
```

Interactive OpenAPI Swagger docs will be available at:
`http://localhost:8300/docs`

### 3. Run Linter and Type Checks
```bash
uv run ruff check src/
uv run mypy src/
```

### 4. Run Test Suite
```bash
uv run pytest
```
