# AI Engineer Roadmap Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a researched, validated AI Engineer learning-tree generator with transparent progress in a side drawer.

**Architecture:** A typed profile and bounded agent service create a validated roadmap blueprint from model-planned web research, then materialize it through the existing workspace graph service. An SSE endpoint exposes public progress to a drawer-based frontend flow.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy async, ai-core provider abstraction, httpx, Next.js, TypeScript, Vitest, Tailwind semantic tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-ai-engineer-roadmap-agent-design.md`

## Global Constraints

- AI Engineer is the only visible profile in this release; the service profile contract must support future profiles.
- Materialize no roadmap unless validation passes with five required phases and at least ten leaf topics.
- Use shared Drawer and Button primitives; no backdrop blur or raw buttons.
- Use central URL helpers for all navigation.
- Agent progress contains public stage summaries and source counts, never hidden reasoning.
- Keep existing `/roadmap/generate` behavior compatible.

---

### Task 1: Typed roadmap-agent domain and validator

**Files:**
- Create: `apps/api/src/schemas/roadmap_agent.py`
- Create: `apps/api/src/services/roadmap_agent_service.py`
- Test: `apps/api/tests/test_roadmap_agent_service.py`

**Interfaces:**
- Produces `RoadmapBlueprint`, `RoadmapBlueprintNode`, `RoadmapSource`, `RoadmapProgressEvent`, and `RoadmapBlueprintValidator.validate(blueprint)`.
- Produces `AI_ENGINEER_PROFILE` and `RoadmapAgentService.build_fallback_blueprint()`.

- [ ] **Step 1: Write failing validator tests** for a valid five-phase, ten-leaf tree and invalid duplicate/orphan/cyclic nodes.
- [ ] **Step 2: Run** `uv run pytest tests/test_roadmap_agent_service.py -q` and confirm the expected import failure.
- [ ] **Step 3: Implement Pydantic schemas, profile guardrails, deterministic fallback blueprint, and validator.**
- [ ] **Step 4: Run the targeted test file and confirm it passes.**
- [ ] **Step 5: Commit** `feat(api): add roadmap agent blueprint validation`.

### Task 2: Bounded research and agent orchestration

**Files:**
- Modify: `apps/api/src/services/roadmap_agent_service.py`
- Create: `apps/api/src/services/roadmap_research.py`
- Test: `apps/api/tests/test_roadmap_agent_service.py`

**Interfaces:**
- Produces `WebResearcher.search(query) -> list[RoadmapSource]` and `RoadmapAgentService.stream_generation(request, owner_id)`.
- Consumes ai-core `get_provider`, `ChatMessage`, and `ModelConfig`.

- [ ] **Step 1: Write failing tests** proving invalid query output falls back to profile queries, sources are normalized, and invalid composition retries once before fallback/error.
- [ ] **Step 2: Run the targeted test file and confirm expected failures.**
- [ ] **Step 3: Implement bounded search, query planning, source truncation, composition, and retry logic.**
- [ ] **Step 4: Run the targeted test file and confirm it passes.**
- [ ] **Step 5: Commit** `feat(api): orchestrate researched roadmap generation`.

### Task 3: SSE endpoint and graph materialization

**Files:**
- Modify: `apps/api/src/routers/roadmap.py`
- Modify: `apps/api/src/services/roadmap_service.py`
- Modify: `apps/api/src/schemas/roadmap.py`
- Test: `apps/api/tests/test_roadmap_agent_router.py`
- Test: `apps/api/tests/test_roadmap_service.py`

**Interfaces:**
- Adds `POST /api/v1/roadmap/agent/stream` emitting `progress`, `complete`, and `error` SSE events.
- Adds `RoadmapService.materialize_blueprint(session, blueprint, owner_id)` returning the workspace and root-node IDs.

- [ ] **Step 1: Write failing router and materialization tests** that assert progress then complete events and root/topic metadata sources.
- [ ] **Step 2: Run target tests and confirm expected failures.**
- [ ] **Step 3: Implement event serialization, materialization from a validated tree, and source metadata.**
- [ ] **Step 4: Run target tests and confirm they pass.**
- [ ] **Step 5: Commit** `feat(api): stream AI engineer roadmap generation`.

### Task 4: Drawer-based AI Engineer generation UI

**Files:**
- Create: `apps/web/src/components/workspace/RoadmapAgentDrawer.tsx`
- Modify: `apps/web/src/components/workspace/WorkspaceDashboard.tsx`
- Modify: `apps/web/src/lib/roadmapApi.ts`
- Test: `apps/web/src/components/workspace/__tests__/roadmap-agent-drawer.test.tsx`
- Test: `apps/web/src/components/workspace/__tests__/workspace-dashboard.test.tsx`

**Interfaces:**
- Produces `RoadmapAgentDrawer({ isOpen, onClose })`.
- Consumes `streamRoadmapAgentGeneration()` and `buildWorkspaceUrl()`.

- [ ] **Step 1: Write failing component tests** for profile selection, progress rendering, source count, retry after an error, and close/navigation after completion.
- [ ] **Step 2: Run** `pnpm --filter @graphmind/web test -- roadmap-agent-drawer` and confirm expected failure.
- [ ] **Step 3: Implement a no-backdrop Drawer using shared primitives and semantic tokens, plus SSE parsing client support.**
- [ ] **Step 4: Run the target frontend tests and confirm they pass.**
- [ ] **Step 5: Commit** `feat(web): add AI engineer roadmap agent drawer`.

### Task 5: Regression verification and documentation

**Files:**
- Modify: `docs/FEATURE_RESEARCH.md`
- Test: `apps/api/tests/test_roadmap_agent_service.py`
- Test: `apps/api/tests/test_roadmap_agent_router.py`
- Test: `apps/web/src/components/workspace/__tests__/roadmap-agent-drawer.test.tsx`

- [ ] **Step 1: Run the full targeted API and web suites.**
- [ ] **Step 2: Run backend Ruff and frontend typecheck/lint.**
- [ ] **Step 3: Update the feature research status with the delivered first slice.**
- [ ] **Step 4: Commit** `docs: record AI engineer roadmap agent delivery`.
