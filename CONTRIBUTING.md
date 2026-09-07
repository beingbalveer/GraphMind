# Contributing to GraphMind

Welcome to the **GraphMind** open-source repository! We are excited to collaborate with engineers, AI researchers, and designers worldwide to build the next-generation graph-first AI knowledge workspace.

---

## 1. Project Philosophy & Architecture

GraphMind is designed around four core tenets:
1. **Human Thought Isn't Linear**: Linear chat logs force context-switching and loss of sub-threads. GraphMind transforms conversations into living spatial trees and 2D concept maps.
2. **Build Interfaces, Not Implementations**: Business logic is completely decoupled from external LLM providers. All LLM calls and tool definitions route through `packages/ai-core`.
3. **Zero Dead UI Policy**: Every button, modal, badge, and canvas node must be fully functional. No placeholder mockups or premature stub features.
4. **Knowledge Evolution**: The workspace is an active collaborator that tracks concept mastery, surfaces skipped prerequisites (gap analysis), recommends next topics, and scrubs timeline history.

---

## 2. Monorepo Layout

```
GraphMind/
├── apps/
│   ├── web/                    # Next.js 15 App Router Frontend (React Flow v12, Tailwind CSS, TypeScript)
│   │   ├── src/app/            # Canonical URL routes (/w/[workspaceId]/chat/[chatId] & /canvas)
│   │   ├── src/components/     # Canvas, Chat, Modals, Multimodal Viewers
│   │   └── src/lib/            # Tree-to-graph algorithms, layout engine, API clients
│   └── api/                    # FastAPI Backend (Python 3.12+, uv package manager)
│       ├── skills/             # Markdown-defined system skills (Code Architect, Deep Research, Quiz Master)
│       └── src/
│           ├── routers/        # FastAPI endpoints (workspaces, chat, files, mastery, curator)
│           ├── services/       # Autonomous tool loop, RAG service, evolution engine
│           └── models/         # SQLAlchemy ORM models (Workspace, Node, Edge, File, Concept)
├── packages/
│   ├── ai-core/                # Provider-agnostic LLM, tool, embedding, and skill abstractions
│   └── shared/                 # Shared TypeScript domain models, schemas, and tree algorithms
├── docs/                       # Architectural Decision Records (ADRs), roadmaps, specs
├── docker-compose.yml          # PostgreSQL 16 (pgvector) & Redis
├── pnpm-workspace.yaml         # PNPM monorepo workspace configuration
└── pyproject.toml              # Root Python workspace configuration (uv)
```

---

## 3. Prerequisites

Before setting up GraphMind locally, ensure you have installed:
- **Node.js**: v20.0.0 or higher
- **pnpm**: v9.0.0 or higher (`npm install -g pnpm` or `corepack enable`)
- **Python**: v3.12.0 or higher
- **uv**: Astral's fast Python package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh` or `brew install uv`)
- **Docker & Docker Compose**: To run local PostgreSQL with `pgvector`

---

## 4. Local Development Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/beingbalveer/GraphMind.git
cd GraphMind
```

### Step 2: Launch Database Infrastructure
Start the PostgreSQL 16 instance with `pgvector` enabled:
```bash
docker compose up -d postgres
```
Verify the container is healthy:
```bash
docker compose ps
```

### Step 3: Configure Environment Variables
Copy the sample environment file for the backend:
```bash
cp apps/api/.env.example apps/api/.env
```
Ensure your database connection string and at least one LLM provider key (e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, or local `OLLAMA_BASE_URL`) are configured:
```ini
DATABASE_URL=postgresql+asyncpg://balveerd:1234@localhost:5432/graphmind
DEFAULT_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key-here
```

### Step 4: Install Dependencies & Run Backend
Using `uv`:
```bash
# Sync Python workspace dependencies and virtual environment
uv sync

# Run FastAPI development server with hot reload
cd apps/api
uv run uvicorn src.main:app --reload --port 8000
```
Open API Swagger docs at `http://localhost:8000/docs`.

### Step 5: Install Dependencies & Run Frontend
In a separate terminal:
```bash
# Install all workspace dependencies
pnpm install

# Build shared package
pnpm --filter @graphmind/shared build

# Start Next.js development server
pnpm --filter @graphmind/web dev
```
Open the web app at `http://localhost:3000`.

---

## 5. Extending GraphMind

### 5.1 Creating a New System Skill
System skills allow GraphMind agents to specialize into specific domain experts (e.g., Code Architect, Deep Research, Quiz Master).

1. Create a markdown file in `apps/api/skills/<skill_name>/SKILL.md`.
2. Define YAML frontmatter with metadata and required tools:
```yaml
---
name: security_auditor
role: Security Auditor
description: Expert security reviewer identifying OWASP Top 10 vulnerabilities, auth flaws, and injection vectors.
required_tools:
  - search_graph
  - traverse_lineage
version: 1.0.0
---

You are a Senior Application Security Auditor. When reviewing code or architecture branches:
1. Identify all potential attack surfaces and taint-analysis paths.
2. Provide concrete remediations with defensive code examples.
```
3. Restart or reload the API; the skill is automatically registered and selectable in the UI!

### 5.2 Adding an Autonomous Graph Tool
GraphMind models can invoke tools iteratively during multi-turn reasoning loops.

1. In `apps/api/src/services/graph_tools.py`, define a Pydantic input schema:
```python
from pydantic import BaseModel, Field
from ai_core.base import BaseTool

class AuditBranchInput(BaseModel):
    branch_root_id: str = Field(..., description="Root node ID of the branch to audit")

class AuditBranchTool(BaseTool):
    name = "audit_branch"
    description = "Inspects all nodes in a conversation branch for technical consistency."
    parameters_schema = AuditBranchInput

    async def execute(self, branch_root_id: str) -> dict:
        # Tool execution logic here
        return {"status": "success", "findings": []}
```
2. Register the tool in `get_tool_registry()` within `apps/api/src/services/tool_service.py`.

### 5.3 URL Routing Rules
Read `docs/URL_DESIGN.md` before adding pages or modifying routing.
- The canonical path format is: `/w/{workspaceId}/chat/{chatId}` and `/w/{workspaceId}/chat/{chatId}/canvas`.
- Always use the URL generator helpers from `@/lib/urls` (`buildWorkspaceUrl`, `buildChatUrl`, `buildCanvasUrl`).
- Never use `window.history.pushState` directly; use Next.js `router.push()` or `router.replace()`.

---

## 6. Testing & Quality Verification

All pull requests must pass 100% of automated tests and static analysis:

```bash
# 1. Run Python test suite (Backend & ai-core)
uv run pytest apps/api

# 2. Run Python linter & type checks
uv run ruff check apps/api

# 3. Run Shared TypeScript package test suite
pnpm --filter @graphmind/shared test

# 4. Run Next.js production build and linting
pnpm build
```

---

## 7. Git Commit & Pull Request Guidelines

We enforce the **Conventional Commits** specification:
- `feat(scope)`: New feature or capability
- `fix(scope)`: Bug fix
- `perf(scope)`: Performance optimization
- `refactor(scope)`: Structural cleanup without behavioral changes
- `docs(scope)`: Documentation updates
- `test(scope)`: Adding or updating test suites

### Pull Request Process
1. Create a feature branch from `main`: `git checkout -b feat/your-feature-name`.
2. Commit your changes in small, logical increments.
3. Run the full verification suite (`pytest`, `ruff`, `vitest`, `pnpm build`).
4. Submit a Pull Request targeting `main` with a clear description of the problem solved, architectural trade-offs, and verification output.

Thank you for helping make GraphMind the ultimate AI knowledge platform!
