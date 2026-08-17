# GraphMind 🧠

> **GraphMind** is an open-source, AI-native knowledge workspace where conversations become interactive, branching knowledge graphs.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15.0%2B-black.svg)](https://nextjs.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-12.0%2B-ff007a.svg)](https://reactflow.dev/)

---

## 🌟 Vision

Traditional AI chatbots present interactions as a linear stream of messages. Complex technical learning, architectural design, and research require branching ideas, contextual exploration, and visual mental mapping.

In **GraphMind**, **knowledge is the product, and chat is only an interface**. Every prompt and response generates an interactive node on a living canvas. Highlight any sentence or code snippet to branch off into focused sub-explorations without losing your place or parent context.

---

## 🏛️ Documentation Index

All core architectural decisions, design philosophies, requirements, and milestone plans are documented under [`docs/`](docs/):

- 📜 [**Manifesto**](docs/MANIFESTO.md): Core product philosophy, graph-first interaction model, and guiding principles.
- 📋 [**Product Requirements Document (PRD)**](docs/PRD.md): Detailed MVP scope, target user personas, functional requirements, and non-goals.
- 📐 [**System Architecture**](docs/ARCHITECTURE.md): System layout, monorepo design, database ERD, data flow diagrams, and `packages/ai-core` provider abstraction.
- 🗺️ [**Roadmap & Milestones**](docs/ROADMAP.md): Breakdown of development milestones (M0 through M6) and exit criteria.
- 📌 [**Single Source of Truth**](PROJECT_CONTEXT.md): Master context document for AI coding assistants and contributors.

### Architectural Decision Records (ADRs)

Key technical decisions are preserved in [`docs/adr/`](docs/adr/):

1. [ADR-0001: Product Identity & Interaction Model](docs/adr/0001-product-identity.md)
2. [ADR-0002: Modular Monolith Monorepo Architecture](docs/adr/0002-modular-monolith-architecture.md)
3. [ADR-0003: AI Provider Abstraction (`packages/ai-core`)](docs/adr/0003-ai-provider-abstraction.md)
4. [ADR-0004: Selection of Apache License 2.0](docs/adr/0004-apache-2.0-license.md)
5. [ADR-0005: Milestone-Driven Execution Strategy](docs/adr/0005-milestone-execution-strategy.md)

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Monorepo** | pnpm Workspaces, `uv` Python workspace |
| **Frontend App** (`apps/web`) | Next.js 15 (App Router), TypeScript, React Flow (`@xyflow/react`), Zustand, TanStack Query, Tailwind CSS, shadcn/ui |
| **Backend API** (`apps/api`) | Python 3.12+, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, structlog |
| **AI Core** (`packages/ai-core`) | Provider-agnostic abstraction layer (OpenAI, Anthropic, Ollama support) |
| **Databases** | PostgreSQL 16 (`pgvector`), Redis 7 |
| **Containerization** | Docker, Docker Compose |

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ & `pnpm`
- [Python](https://www.python.org/) v3.12+ & [`uv`](https://docs.astral.sh/uv/)
- [Docker](https://www.docker.com/) & Docker Compose

### Running via Docker Compose
```bash
# Clone the repository
git clone https://github.com/your-username/GraphMind.git
cd GraphMind

# Launch services (PostgreSQL, Redis, API, Web)
docker-compose up --build
```

Access the frontend at `http://localhost:3000` and backend API docs at `http://localhost:8000/docs`.

---

## 📄 License

GraphMind is open-source software licensed under the [Apache License 2.0](LICENSE).
