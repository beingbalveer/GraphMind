# GraphMind 🧠

> **GraphMind** is an open-source, AI-native knowledge workspace where conversations become interactive, branching knowledge graphs.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.1%2B-black.svg)](https://nextjs.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-12.4%2B-ff007a.svg)](https://reactflow.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791.svg)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6.svg)](https://www.typescriptlang.org/)

---

## 🌟 Vision

Traditional AI chatbots present interactions as an ephemeral, single vertical stream of messages. Complex technical learning, architectural design, and research require branching ideas, contextual exploration, and visual mental mapping.

In **GraphMind**, **knowledge is the product, and chat is only an interface**. Every prompt and response generates an interactive node on a living canvas. Highlight any sentence or code snippet to branch off into focused sub-explorations without losing your place or parent context.

---

## ✨ Key Features

### 🌐 Living 2D Spatial Canvas & Mindmap Layout
- **Infinite 2D Workspace**: Render entire conversation topologies powered by `@xyflow/react` with smooth zooming, panning, minimap navigation, and custom node styling.
- **Dual Layout Engines**: Toggle seamlessly between **Dagre Hierarchical Auto-Layout** (top-to-bottom flow) and **Mindmap Radial/Horizontal Layout**.
- **Level of Detail (LOD) Rendering**: Adaptive rendering modes (full markdown, compact summary, or collapsed card) preserve performance across massive knowledge trees.
- **Focus Reader Drawer & Command Palette**: Click any node to open a full distraction-free reading drawer with KaTeX math and syntax highlighting, or hit `Cmd+K` for rapid navigation.

### 🌳 Hierarchical Tree Branching & Lineage Traversal
- **Text-Selection Branching**: Select any sentence, snippet, or phrase in an AI message to trigger a contextual branching tooltip and fork a new investigation.
- **Smart Ancestor Lineage**: Child nodes inherit only their true ancestral conversation path, preserving prompt clarity and preventing token bloat.
- **Side-Peek Branch Sheet & Resizable Split Pane**: Inspect child conversations side-by-side with parent context.

### 📂 Multimodal Workspace Library & In-App Viewers
- **Workspace Asset Management**: Upload, organize, and attach documents, spreadsheets, images, and source code directly into your research conversations.
- **Interactive Modal Viewers**:
  - 📄 **PDF Reader**: Page-by-page modal reader with text extraction via `pypdf`.
  - 💻 **Code Viewer**: Syntax-highlighted modal viewer for Python, TypeScript, SQL, JSON, YAML, and more.
  - 📊 **Tabular Data Explorer**: Full-featured interactive grid for CSV, TSV, JSONL, and Excel (`.xlsx`) datasets with sorting, filtering, and summary statistics.
- **Structured Context Ingestion**: Automatic parser converts uploaded spreadsheets and documents into structured LLM prompts.

### 🤖 Autonomous Tool Execution & Web Grounding
- **Agentic Tool Loop**: The backend executes multi-turn tool calling autonomously, streaming real-time status updates and execution results via Server-Sent Events (SSE).
- **Graph-Native Tools**: LLMs can autonomously query the graph:
  - `search_graph`: Semantic keyword search across all workspace nodes.
  - `fetch_node_details`: Inspect complete markdown content, parentage, and metadata of any node.
  - `get_node_neighbors`: Explore parent and child connections to map relationships.
  - `traverse_branch_lineage`: Trace the full root-to-leaf lineage of an argument or concept.
- **Live Web Search & Grounding**: Web search integration (DuckDuckGo / search grounding) enables models to fetch external facts and citations in real time.

### 🧩 Markdown-Driven System Skills
- **Pluggable System Personas**: Extend the AI's capabilities via declarative markdown skill definitions under `apps/api/skills/`:
  - 🏗️ **Code Architect**: Senior systems architect enforcing clean abstractions, production design patterns, and idiomatic implementations.
  - 🔬 **Deep Research**: Rigorous academic researcher synthesizing evidence, comparing trade-offs, and citing sources.
  - 🎯 **Quiz Master**: Traverses conversation nodes to test understanding through interactive multiple-choice questions and code challenges.

### ⚡ Provider-Agnostic Foundation Core (`packages/ai-core`)
- Completely decoupled foundation model layer supporting:
  - **Google Gemini** (`gemini-2.5-pro`, `gemini-2.5-flash` with multimodal attachments & native search grounding)
  - **Anthropic Claude** (`claude-3-5-sonnet` with multimodal image/document support)
  - **OpenAI** (`gpt-4o`, `gpt-4o-mini` with native function/tool calling)
  - **DeepSeek** (`deepseek-chat`, `deepseek-reasoner`)
  - **Ollama** (Local offline LLMs)
  - **Mock Provider** (Deterministically testable streaming without API costs)
- Built-in embedding abstractions (`pgvector`, OpenAI `text-embedding-3-small`, Gemini Embeddings).

### 💾 Relational Persistence & State Sync
- **PostgreSQL 16 with Async SQLAlchemy 2.0**: Workspaces, nodes, edges, files, and tags persisted with foreign key cascades and Alembic migrations.
- **Debounced Viewport Auto-Save**: Seamlessly preserves canvas pan, zoom, and card coordinate positions across sessions.
- **Demo Workspace Seeding**: Built-in interactive onboarding workspace demonstrating branching, tool usage, and multimodal features out-of-the-box.

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client["Frontend (Next.js 15 App Router / React Flow)"] -->|REST / SSE Streaming| API["Backend API (FastAPI)"]
    API -->|Async ORM / SQL| DB[("PostgreSQL 16 + pgvector")]
    API -->|Local File Storage / Assets| FS[("Workspace File Storage")]
    API -->|Tool Execution Loop| Tools["Graph Tools & Web Grounding"]
    API -->|Internal Dependency| AICore["packages/ai-core"]
    AICore -->|Provider Interface| Gemini["Google Gemini API"]
    AICore -->|Provider Interface| Anthropic["Anthropic Claude API"]
    AICore -->|Provider Interface| OpenAI["OpenAI API"]
    AICore -->|Provider Interface| DeepSeek["DeepSeek API"]
    AICore -->|Provider Interface| Ollama["Local Ollama"]
```

---

## 📁 Repository Structure

```
GraphMind/
├── apps/
│   ├── web/                    # Next.js 15 App Router Frontend
│   │   ├── src/app/            # Canonical URL routes (/w/[workspaceId]/chat/[chatId])
│   │   ├── src/components/     # Canvas, Chat, Modals (PDF, Code, Table), UI library
│   │   └── src/store/          # Zustand client state stores (chat, canvas, settings)
│   └── api/                    # FastAPI Backend Application
│       ├── skills/             # Declarative system skills (Code Architect, Deep Research, Quiz Master)
│       └── src/
│           ├── routers/        # API endpoints: workspaces, chat, files
│           ├── services/       # Tool engine, graph tools, file parsing, semantic search, seeding
│           └── models/         # SQLAlchemy ORM models (Workspace, Node, Edge, File)
├── packages/
│   ├── ai-core/                # Provider-agnostic LLM, embedding, tool, and skill abstractions
│   └── shared/                 # Shared TypeScript types, schemas, and API contracts
├── docs/                       # Architecture specs, PRDs, Manifesto, ADRs, Phase roadmaps
├── docker-compose.yml          # PostgreSQL (pgvector), Redis, and service containerization
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── pyproject.toml              # Python workspace configuration (uv)
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) (Strict) |
| **Spatial Canvas** | [React Flow](https://reactflow.dev/) (`@xyflow/react` v12), [@dagrejs/dagre](https://github.com/dagrejs/dagre) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) (Client Canvas & Chat State) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Lucide Icons](https://lucide.dev/) |
| **Markdown & Math** | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex` ([KaTeX](https://katex.org/)), `rehype-highlight` |
| **Backend Framework** | [FastAPI](https://fastapi.tiangolo.com/) (Async), [Pydantic v2](https://docs.pydantic.dev/), [Uvicorn](https://www.uvicorn.org/) |
| **Database & ORM** | [PostgreSQL 16](https://www.postgresql.org/) with [`pgvector`](https://github.com/pgvector/pgvector), [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (asyncpg), [Alembic](https://alembic.sqlalchemy.org/) |
| **Multimodal Parsing** | `pypdf` (PDF text extraction), `openpyxl` (Excel spreadsheets), Python `csv` engine |
| **AI Foundation Core** | `packages/ai-core` (Gemini, Claude, OpenAI, DeepSeek, Ollama, Vector Embeddings) |
| **Package Managers** | [pnpm](https://pnpm.io/) (Node workspaces), [`uv`](https://docs.astral.sh/uv/) (Python workspace) |

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js**: v20+ & **pnpm** (`npm install -g pnpm`)
- **Python**: v3.12+ & [**uv**](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Docker & Docker Compose** (for PostgreSQL with `pgvector`)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/beingbalveer/GraphMind.git
cd GraphMind

# Install frontend and monorepo dependencies
pnpm install

# Setup Python virtual environment and dependencies
uv sync
```

### 3. Configure Environment Variables
Copy the example environment files:
```bash
cp apps/api/.env.example apps/api/.env
```

Configure your LLM API keys in `apps/api/.env`:
```env
# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/graphmind

# Primary AI Provider (gemini, openai, anthropic, deepseek, ollama, mock)
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash

# API Keys (set at least one for live responses)
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Start Infrastructure (PostgreSQL + pgvector)
```bash
# Start PostgreSQL with pgvector in the background
docker-compose up -d postgres
```

### 5. Run Database Migrations
```bash
uv run alembic upgrade head
```

### 6. Launch Development Servers
Run both frontend and backend concurrently with hot-reloading:
```bash
pnpm dev
```
- **Web UI**: [http://localhost:3300](http://localhost:3300)
- **FastAPI Docs (Swagger)**: [http://localhost:8300/docs](http://localhost:8300/docs)
- **API Base**: [http://localhost:8300/api/v1](http://localhost:8300/api/v1)

---

## 🔗 Canonical URL Routing Contract

GraphMind enforces a strict, hierarchical URL design (see [`docs/URL_DESIGN.md`](docs/URL_DESIGN.md)):

| Route Path | View / Mode | Purpose |
| :--- | :--- | :--- |
| `/w/{workspaceId}` | Workspace Landing | Overview, file library, and workspace dashboard |
| `/w/{workspaceId}/chat/{chatId}` | Chat View | Linear stream & branch conversation interface |
| `/w/{workspaceId}/chat/{chatId}/canvas` | Canvas View | 2D visual knowledge graph and spatial mindmap |

---

## 🏛️ Documentation Index

- 📜 [**Manifesto**](docs/MANIFESTO.md): Core product philosophy, graph-first interaction model, and guiding principles.
- 📋 [**Product Requirements Document (PRD)**](docs/PRD.md): MVP scope, target user personas, and functional requirements.
- 📐 [**System Architecture**](docs/ARCHITECTURE.md): Technical layout, database ERD, data flows, and tool execution.
- 🗺️ [**Evolutionary Roadmap**](docs/ROADMAP.md): Detailed progression across Phases 1 through 6.
- 🔗 [**URL Routing Contract**](docs/URL_DESIGN.md): Architectural spec for URL hierarchy and path management.
- 📌 [**Master Project Context**](PROJECT_CONTEXT.md): Authoritative context document for contributors and AI coding assistants.

### Architectural Decision Records (ADRs)
1. [ADR-0001: Product Identity & Interaction Model](docs/adr/0001-product-identity.md)
2. [ADR-0002: Modular Monolith Monorepo Architecture](docs/adr/0002-modular-monolith-architecture.md)
3. [ADR-0003: AI Provider Abstraction (`packages/ai-core`)](docs/adr/0003-ai-provider-abstraction.md)
4. [ADR-0004: Selection of Apache License 2.0](docs/adr/0004-apache-2.0-license.md)
5. [ADR-0005: Milestone-Driven Execution Strategy](docs/adr/0005-milestone-execution-strategy.md)
6. [ADR-0006: Canonical URL Routing Contract](docs/adr/0006-url-routing-design.md)

---

## 📄 License

GraphMind is open-source software licensed under the [Apache License 2.0](LICENSE).
