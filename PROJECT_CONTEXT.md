# GraphMind — Master Project Context

> **Purpose:** This document is the single source of truth for AI coding assistants (Antigravity, Claude Code, Cursor, ChatGPT, Copilot, etc.). Use it to generate documentation, architecture, and code. Treat all decisions marked **Frozen** as authoritative unless explicitly changed.

# 1. Mission

Build **GraphMind**, an open-source, production-quality AI-native knowledge workspace.

The goal is **not** to build another ChatGPT clone.

The goal is to build a graph-first workspace where conversations become structured knowledge and where AI helps users learn, explore and evolve their understanding.

A secondary but extremely important goal is that this repository should demonstrate senior-level AI engineering, backend engineering, software architecture and open-source practices, helping its creator build credibility and career opportunities.

# 2. Success Criteria

Someone opening the repository should think:

- This engineer understands software architecture.
- This engineer understands AI systems.
- This engineer writes production-quality code.
- This project is thoughtfully designed.

Do not optimize for startup scale today.
Optimize for excellent engineering and a polished open-source repository.

# 3. Product Vision (Frozen)

Knowledge is the product.

Chat is only the interface.

The workspace is graph-first.

Conversations branch naturally instead of remaining linear.

Every interaction should contribute to a user's long-term knowledge graph.

# 4. Target Users (Frozen)

Primary:
- Software engineers
- AI engineers
- Backend engineers
- Developers learning technical topics

Future:
Researchers, students and knowledge workers.

# 5. Core Product Principles (Frozen)

1. Knowledge is the product.
2. Chat is only an interface.
3. The graph is the primary workspace.
4. Conversations should branch naturally.
5. Every interaction enriches the knowledge graph.
6. AI organizes knowledge automatically.
7. Users own their knowledge.
8. Build interfaces, not implementations.
9. AI-provider agnostic.
10. Documentation is part of the product.
11. Keep MVP simple.
12. No premature abstraction.
13. No rewrites during a milestone.
14. Every milestone must be releasable.
15. Every important feature should be observable.
16. Simplicity before abstraction.

# 6. Project Philosophy

We are not building an AI chatbot.

We are designing a new interaction model for learning.

The software should adapt to how humans think.

Humans think through branching ideas, not linear conversations.

# 7. WOW Feature (Frozen)

Knowledge Evolution.

The system gradually understands what the user knows, what concepts connect together and what should be explored next.

This is NOT part of the MVP but should influence architecture.

# 8. MVP Scope (Frozen)

Included:
- User authentication
- Workspace creation
- Ask AI questions
- AI responses
- Every response becomes a graph node
- Graph visualization
- Continue conversation from any node
- Highlight text to create child branches
- Save graph
- Reload graph

Explicitly NOT included:
- Multi-agent orchestration
- Collaboration
- Marketplace
- Desktop app
- Mobile app
- Plugin ecosystem
- Knowledge evolution
- Multiple built-in providers

# 9. Platform Decisions

Platform:
- Web-first

Future:
- Desktop (Tauri)
- Mobile
- VS Code extension
- Obsidian plugin

Deployment:
- Cloud-first
- Docker self-hosting supported

# 10. Repository Strategy

Monorepo.

apps/
- web
- api

packages/
- ai-core
- shared

docs/

Additional packages should only be created when necessary.

# 11. Backend

Language:
Python

Framework:
FastAPI

Python Version:
3.12+

Package Manager:
uv

Architecture:
Modular Monolith

NOT microservices.

# 12. Frontend

Framework:
Next.js (App Router)

Language:
TypeScript

UI:
Tailwind CSS
shadcn/ui

Graph:
React Flow

State:
Zustand

Server State:
TanStack Query

Forms:
React Hook Form

Validation:
Zod

# 13. Database

Primary:
PostgreSQL

Extensions:
pgvector

Cache:
Redis

ORM:
SQLAlchemy

Migrations:
Alembic

No Neo4j in MVP.

# 14. API

REST API

Versioning:
/api/v1

Auto-generated OpenAPI.

# 15. Authentication

Custom implementation.

Support:
- Email/password
- Google OAuth
- GitHub OAuth

JWT + Refresh Tokens.

# 16. AI Architecture

AI must be provider agnostic.

Provider abstraction layer built in `packages/ai-core`.

Current provider implementations:
- Google Gemini (Gemini 2.5 Flash & Pro with native grounding, multimodal files, and tools)
- Anthropic Claude (Claude 3.5 Sonnet & Haiku with multimodal document/image analysis)
- OpenAI (GPT-4o, GPT-4o-mini with function calling)
- DeepSeek (Chat & Reasoner)
- Ollama (Local offline models)
- Mock Provider (Deterministic testing with token streaming)

Application code must never directly depend on provider SDKs.

# 17. AI Core

Internal package: `packages/ai-core`

Abstractions provided:
- BaseProvider (generate, stream, stream_with_tools)
- BaseEmbeddingProvider (OpenAI, Gemini, Mock)
- BaseTool, ToolCall, ToolResult (autonomous function calling)
- Skill (markdown-defined system personas)
- Lineage context traversal engine
- Message, Role, LLMConfig, TokenUsage

The application depends strictly on `ai-core`.

# 18. Agent Strategy

Autonomous Tool Execution & Skills:
- Autonomous multi-turn tool calling loop in FastAPI with SSE streaming.
- Graph-native tools: search_graph, fetch_node_details, get_node_neighbors, traverse_branch_lineage, search_web_grounding.
- Declarative system skills (`apps/api/skills/`):
  - Code Architect
  - Deep Research
  - Quiz Master

Future:
- Visual Mastery Heatmap
- Automated Gap Analysis & Evolution Engine
- Timeline Replay View

# 19. Folder Structure

/
apps/
  web/
  api/
packages/
  ai-core/
  shared/
docs/
docker/
README.md
LICENSE
docker-compose.yml
pnpm-workspace.yaml

# 20. UX Philosophy

Primary workspace = Graph.

No dedicated chat-first experience.

The graph should be visible immediately.

The first prompt creates the first node.

Every answer creates another node.

Selecting text allows branching.

The graph should feel like a living knowledge map.

# 21. Design System

Style:
Professional
Minimal
Premium

Inspiration:
Gemini
Linear
(With some Obsidian concepts)

Light theme first.

Support dark mode later.

Subtle rounded corners.

No excessive gradients.

Whitespace and typography are more important than decorations.

# 22. Documentation

Initially create:

README.md
MANIFESTO.md
ARCHITECTURE.md
ROADMAP.md

ADRs can be added incrementally.

# 23. Dev Philosophy

80% shipping
20% planning

Every 2–3 days should produce visible progress.

Ideas beyond the MVP go into the roadmap instead of interrupting the current milestone.

# 24. Milestones & Progress

- M0 Repository Foundation: Completed ✅
- M1 UI Shell & Linear Stream: Completed ✅
- M2 AI Chat Engine & SSE Streaming: Completed ✅
- M3 Graph Nodes & React Flow Canvas: Completed ✅
- M4 Branching & Lineage Traversal: Completed ✅
- M5 Persistence, Workspaces & File Library: Completed ✅
- M6 Knowledge Evolution, Autonomous Tools & Skills: Core runtime delivered ✅ (Mastery modeling & Curator in progress)

# 25. Code Quality

Backend:
Ruff
Black
MyPy
Pytest

Frontend:
ESLint
Prettier
Vitest
Playwright

Git:
GitHub Flow
Conventional Commits

# 26. Non-goals

Do not:
- Build everything immediately.
- Over-engineer.
- Create unnecessary packages.
- Add features outside MVP.
- Couple business logic to LangChain/LangGraph.
- Optimize for millions of users.

# 27. Instructions for AI Coding Assistants

Always preserve the architecture above.

Prefer simple, readable, production-quality code.

Explain architectural decisions.

Do not introduce abstractions without a clear reason.

When uncertain, choose the simplest solution compatible with future growth.

Do not generate unnecessary infrastructure.

Focus on delivering the current milestone.

