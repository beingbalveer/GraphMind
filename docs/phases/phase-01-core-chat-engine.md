# Phase 1: Production Core & Streamed Chat Engine

**Estimated Timeline:** 2 – 3 Weeks (~30 – 40 Engineering Hours @ 2 hrs/day)  
**Status:** In Progress / Ready for Execution  
**Goal:** Build a rock-solid, production-grade streaming chat engine with provider-agnostic abstractions and a clean, Gemini/Linear-inspired UI.

---

## 1. Executive Summary

Phase 1 establishes the baseline engineering foundation of GraphMind. Before introducing 2D canvases or graph algorithms, we build an exceptionally fast, resilient, and type-safe AI chat system. Every component written in this phase is designed to be cleanly extended by subsequent tree, canvas, and persistence phases without rewrites.

---

## 2. Architecture & Data Flow

```
[ Next.js 15 Client ]
        │  ▲
        │  │ Server-Sent Events (SSE) Stream
        ▼  │
[ FastAPI Stream Endpoint (/api/v1/chat/stream) ]
        │  ▲
        │  │ Async Token Generator
        ▼  │
[ packages/ai-core (BaseLLMProvider Interface) ]
        │  ▲
        │  │ Async Provider Client
        ▼  │
[ OpenAI / Mock LLM Provider ]
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 1.1: Monorepo & Infrastructure Scaffolding
*Estimated Time: 3 – 4 Days*

- [ ] **Task 1.1.1 — Workspace Scaffolding**: Setup `pnpm` workspaces for frontend/packages and `uv` virtual environments for Python backend.
  - Structure: `apps/web`, `apps/api`, `packages/ai-core`, `packages/shared`.
- [ ] **Task 1.1.2 — Local Docker Compose**: Create `docker-compose.yml` with PostgreSQL 16 (`pgvector`), Redis, API, and Web containers.
- [ ] **Task 1.1.3 — Code Quality & Linters**:
  - Python: Configure `ruff` (linter/formatter), `mypy` (strict typing), `pytest`.
  - TypeScript: Configure `eslint`, `prettier`, `tsconfig.json` base configs.
- [ ] **Task 1.1.4 — Configuration Management**: Setup Pydantic `BaseSettings` for API and `.env` loading conventions.

### Sub-Phase 1.2: AI Core & Provider Abstraction Layer (`packages/ai-core`)
*Estimated Time: 3 – 4 Days*

- [ ] **Task 1.2.1 — Domain Interfaces**:
  - Abstract class `BaseLLMProvider` with `generate()` and `stream()` methods.
  - Pydantic models: `ChatMessage`, `ChatRole`, `StreamChunk`, `ModelConfig`, `TokenUsage`.
- [ ] **Task 1.2.2 — OpenAI Provider**: Implement `OpenAIProvider` with retry logic, backoff, and async generator streaming.
- [ ] **Task 1.2.3 — Mock Provider**: Implement `MockLLMProvider` yielding predictable test tokens and simulated latency for cost-free testing.
- [ ] **Task 1.2.4 — Provider Factory**: Factory method `get_llm_provider(config)` for dynamic runtime provider swapping.

### Sub-Phase 1.3: FastAPI Chat Engine & Streaming API (`apps/api`)
*Estimated Time: 4 – 5 Days*

- [ ] **Task 1.3.1 — App Skeleton & Middleware**: Setup FastAPI with CORS, request-ID tracing, and global exception handlers.
- [ ] **Task 1.3.2 — SSE Endpoint (`/api/v1/chat/stream`)**: Server-Sent Events endpoint with structured event types (`token`, `error`, `done`) and client disconnect handling.
- [ ] **Task 1.3.3 — Standard Endpoint (`/api/v1/chat/completions`)**: Non-streaming fallback route.
- [ ] **Task 1.3.4 — Structured Logging**: JSON logging middleware tracking latency, status, and token metrics.
- [ ] **Task 1.3.5 — Backend Pytest Suite**: Async unit and integration tests covering streaming and error scenarios.

### Sub-Phase 1.4: Next.js UI Shell & Design System (`apps/web`)
*Estimated Time: 3 – 4 Days*

- [ ] **Task 1.4.1 — Framework & Styling**: Next.js 15 App Router + Tailwind CSS + Typography configuration.
- [ ] **Task 1.4.2 — shadcn/ui Components**: Setup Button, Textarea, Dropdown, Toast, ScrollArea, and Tooltip.
- [ ] **Task 1.4.3 — Layout Shell**: Clean Navbar (status badge, model selector), Main Chat Viewport, and bottom Input Area.
- [ ] **Task 1.4.4 — Auto-Resizing Prompt Box**: Multi-line textarea supporting `Enter` to submit, `Shift+Enter` for newline, and Stop button.

### Sub-Phase 1.5: Stream Consumer & Rich Markdown Renderer
*Estimated Time: 4 – 5 Days*

- [ ] **Task 1.5.1 — Streaming Hook (`useChatStream`)**: Custom React hook handling SSE stream consumption, abort controller, error handling, and state management.
- [ ] **Task 1.5.2 — Markdown Renderer**: Code syntax highlighting, copy-code button, language tags via `react-markdown` + `shiki`/`highlight.js`.
- [ ] **Task 1.5.3 — LaTeX Math Equations**: KaTeX integration for inline ($...$) and display ($$...$$) math formulas.
- [ ] **Task 1.5.4 — Viewport & Scroll Lock**: Smooth auto-scrolling with manual scroll-up pause detection.

### Sub-Phase 1.6: End-to-End Testing & Phase Packaging
*Estimated Time: 2 – 3 Days*

- [ ] **Task 1.6.1 — Frontend Vitest Suite**: Test streaming hook, markdown component, and error toast behaviors.
- [ ] **Task 1.6.2 — Playwright Smoke Test**: Automated browser test for prompt input, token streaming, and response completion.
- [ ] **Task 1.6.3 — Architecture Documentation**: Write `docs/architecture/01-chat-engine.md`.

---

## 4. Exit & Acceptance Criteria

1. `docker compose up` starts all services cleanly.
2. User can submit a prompt and watch tokens stream in real time with syntax-highlighted code and LaTeX equations.
3. Clicking "Stop" cancels the backend stream immediately without lingering tasks.
4. All linters (`ruff`, `mypy`, `eslint`) and tests (`pytest`, `vitest`) pass with zero errors.
