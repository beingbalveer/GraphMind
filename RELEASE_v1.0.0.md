# GraphMind v1.0.0 — Release Notes

> **"Human thought isn't linear. Your AI workspace shouldn't be either."**

We are thrilled to announce the official **v1.0.0 release of GraphMind** — the AI-native, graph-first knowledge workspace that turns conversations into spatial mind maps, coordinates specialized multi-agent crews, and actively guides your technical mastery through knowledge evolution.

---

## 🌟 The Journey: From Inception to v1.0.0

Over the course of six architectural phases, GraphMind has evolved from a minimalist streamed chat into a complete knowledge operating system:

| Phase | Milestone Name | Key Capabilities Delivered |
| :--- | :--- | :--- |
| **Phase 1** | **Minimal Streamed AI Chat** | Provider-agnostic `packages/ai-core`, real-time SSE streaming, auto-scroll anchors, and multi-provider BYOK (Gemini, OpenAI, Claude, DeepSeek, Ollama). |
| **Phase 2** | **Tree-Structured Branching** | Linear chat transformed into branching DAG trees, highlight-to-branch excerpts, breadcrumb navigation, and lineage-preserving prompt builders. |
| **Phase 3** | **2D Spatial Canvas** | Interactive React Flow v12 canvas, three-tier Level-of-Detail (Galaxy Note Orbs, Thread Tree, Focus View), collision-free Dagre auto-layout, and radar minimap. |
| **Phase 4** | **Persistent Workspaces** | PostgreSQL 16 (asyncpg) persistence, debounced delta sync, multimodal file ingestion (PDF, Excel, CSV, TSV, Code), and in-canvas previewers. |
| **Phase 5** | **Semantic Discovery & RAG** | pgvector dense embeddings, PostgreSQL tsvector GIN full-text index, hybrid RAG with Reciprocal Rank Fusion (RRF), and cross-branch discovery. |
| **Phase 6** | **Multi-Agent & Knowledge Evolution** | Autonomous multi-turn tool runtime, system skills (Code Architect, Deep Research, Quiz Master), concept mastery modeling, prerequisite gap analysis, next topic recommendations, and timeline evolution scrubbing. |

---

## 🚀 What's New in v1.0.0

### 1. Multi-Agent Workflows & Declarative System Skills
- **Code Architect Skill**: Senior architectural persona enforcing production design patterns, type safety, backpressure limits, and trade-off matrices.
- **Deep Research Skill**: In-depth investigator performing autonomous web searches and graph traversals to ground discussions with empirical benchmark citations.
- **Quiz Master Skill**: Interactive pedagogical evaluator testing understanding of conversation sub-branches with immediate scoring feedback.
- **Autonomous Tool Runtime**: Multi-turn tool execution loop streaming real-time `tool_call` and `tool_result` SSE events.

### 2. The Knowledge Evolution Engine (The WOW Feature)
- **Visual Mastery Heatmap**: Real-time canvas overlay illuminating nodes by concept mastery (`mastered` = green, `quizzed` = purple, `explored` = blue, `stale` = amber).
- **Prerequisite Gap Analysis**: Compares your explored graph against a domain ontology DAG (e.g. flagging that you learned `Asyncio Tasks` without exploring `Event Loops`).
- **Next Best Topic Recommendations**: Forward frontier search ranking logical next learning steps with prerequisite satisfaction scores and synergy metrics.
- **Timeline Replay View**: Interactive scrubbing bar with milestone tick marks, playback controls (1x, 2x, 5x), and live counter badges to replay your knowledge graph evolution over time.

### 3. Enterprise Performance & Sub-50ms Benchmarks
- **Algorithmic Complexity Reduction**: Optimized tree lineage resolution and graph filtering from $O(N^2)$ to strictly linear $O(N)$.
- **HNSW Vector Indexing**: Sub-10ms approximate nearest neighbor search across large workspaces ($500+$ nodes).
- **Composite Database Indexes**: Eliminated filesorts on `nodes (workspace_id, created_at)` and `workspace_concepts (workspace_id, created_at)`.
- **Single-Pass Memoized Canvas Layouts**: Smooth 60fps pan/zoom performance in React Flow with Level-of-Detail capsule culling.

### 4. Self-Hosting & Production Containerization
- **Single-Command Launch**: `docker compose up -d` spins up PostgreSQL 16 with `pgvector`, Redis, FastAPI backend, and Next.js frontend.
- **Local Model Support**: Connect directly to Ollama running locally (`http://localhost:11434/v1`) with zero external API dependencies.

---

## 🛠️ Quickstart (Self-Hosting)

```bash
# 1. Clone the repository
git clone https://github.com/beingbalveer/GraphMind.git
cd GraphMind

# 2. Copy the environment template
cp .env.example .env

# 3. Add your Gemini or OpenAI API key to .env (or leave blank to use local Ollama)
# nano .env

# 4. Start all services
docker compose up -d

# 5. Open your browser
# Web Interface: http://localhost:3300
# API Docs:      http://localhost:8300/docs
```

---

## 🧪 Verification & Test Suite Summary

GraphMind v1.0.0 ships with 100% automated test coverage across both Python and TypeScript:
- **Backend**: **65 / 65** Pytest suites passing (`apps/api/tests`)
- **Scale Benchmarks**: Lineage resolution $< 5\text{ms}$ on 500+ nodes, ancestor retrieval $< 1\text{ms}$ on 1,000 nodes.
- **Shared Package**: **16 / 16** Vitest tests passing (`packages/shared/tests`)
- **Linting & Types**: `ruff` and `tsc` 100% clean (0 errors, 0 warnings).
- **Production Build**: Next.js 15 App Router build passing with static prerendering and dynamic URL routing.

---

## 🤝 Contributing & Community

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for local development workflows, architecture guidelines, and instructions on creating custom system skills.

*Thank you to all our contributors, testers, and the open-source community for making GraphMind v1.0.0 a reality!*
