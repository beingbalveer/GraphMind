# GraphMind — Roadmap Generator Dogfood Report (interim)

**Branch:** `codex/roadmap-generator` @ 74ac486 · **Date:** 2026-10-10 · **Tester:** Hermes (as a real user)

Setup used: local Postgres 17 + pgvector, Redis, `uv` API on :8300, Next dev on :3300, roadmap worker via `pnpm dev`. Fresh account via signup.

## Findings

### F1 · BLOCKER — Silent mock fallback produces a fake "successful" roadmap
- **Where:** `apps/api/src/services/roadmap_service.py` (legacy `/api/v1/roadmap/generate`) + `packages/ai-core/src/ai_core/providers/__init__.py:85`
- **Steps:** Generate roadmap from the UI with no API key configured.
- **Actual:** HTTP **201**, workspace created titled literally `Roadmap Title`, topic nodes containing the prompt's own example text (`Foundational Concept 1`, `Concept D`, `2-3 sentence overview of this curriculum`). Verified in DB (`nodes` table) and in the UI.
- **Root cause chain:** no key → `get_provider` silently returns `MockProvider` → mock echoes the last prompt back → `_parse_plan_json`'s greedy regex `\{.*\}` extracts the **example JSON embedded in the prompt** → parses "valid" plan → persisted as a real roadmap.
- **Expected:** explicit `MODEL_NOT_CONFIGURED` error, like the async jobs path correctly does.
- **Contradicts:** README/worker docs: "roadmap generation has no offline mock fallback" (true for the worker, false for this endpoint).
- **Also:** the router allows unauthenticated calls (`get_optional_user`) and then assigns owner `usr_default_admin` — anonymous users create workspaces owned by a privileged sentinel account.

### F2 · HIGH — Canvas is empty after roadmap generation
- **Steps:** Generate roadmap → open the workspace → Canvas tab.
- **Actual:** "Your conversation will appear here." Zero nodes rendered, despite 3 nodes in the DB. Roadmap nodes are created with no conversation/chat linkage, so the canvas shows nothing.

### F3 · HIGH — Flagship researched-roadmap wizard unreachable in a fresh clone  *(FIXED 2026-10-10)*
- `RoadmapModal` only renders the new jobs-based wizard when `NEXT_PUBLIC_ROADMAP_GENERATOR_ENABLED === "true"`. That variable exists only in the **repo-root** `.env.example`; the web app (Next, cwd `apps/web`) reads no env file there → flag is undefined → users silently get `LegacyRoadmapModal` (the deprecated sync endpoint). Fresh-clone setup (`cp .env.example .env`) never enables the new generator.
- **Fix applied:** committed `apps/web/.env.example` (flag + `NEXT_PUBLIC_API_URL`), README setup note to copy it to `apps/web/.env.local`. Verified in browser: the new wizard now opens and the roadmap-jobs notice renders.
- Verified empirically: the modal shown was the legacy one, and the API log shows only `POST /roadmap/generate` (legacy), no `/roadmap/jobs`.

### F4 · OK — Async jobs pipeline behaves honestly (verified via API)
- Created job → `queued` → `start` → `failed` with `MODEL_NOT_CONFIGURED, recoverable=true, nextAction=retry`. Matches documented behavior; good design. (Worker picks the job up correctly.)
- Note: legacy-generated workspaces return 404 `ROADMAP_NOT_FOUND` on the new `/workspaces/{id}/roadmap` curriculum view — two-track incompatibility for users on the legacy path.

### F5 · Minor
- Idempotency-Key must be a UUID (unhelpful error for API users).
- Signup/login fine; auth via httpOnly cookies is good (session verified across tabs).
- Everything labeled "roadmap" in the sidebar shows the placeholder title `Roadmap Title` (part of F1).

### F6 · HIGH — Compose stage fails systematically with Gemini 2.5 Flash (0/2 real runs)
- **Steps:** Two live generate jobs with real GEMINI_API_KEY (topics: "agentic AI with LangGraph", "FastAPI & async Python"). Both ran `understand` → `research` → `compose`.
- **Actual:** both died at `compose` after 3 validation attempts, every rejection on the same constraint family: `resources.N.evidenceExcerpt` must be 80–500 chars — the model writes excerpts outside those bounds. Each repair attempt **regenerates the entire 35–40k-char payload** (~1 min + full token cost per attempt), only fixing a few fields each time.
- **Impact:** ~4–6 minutes and heavy token spend per run, ending in `STAGE_OUTPUT_INVALID` with `recoverable=false` and the misleading message "Try a more specific goal" — the goal was specific; the schema is brittle.
- **Recommended fixes:** (1) programmatically clamp/pad excerpts in a post-validation repair pass instead of full-payload regeneration; (2) targeted repair that resends only failing fields; (3) either raise max_tokens or chunk the compose output — 40k chars in one response is at the model's ceiling; (4) honest error copy.
- Also observed (run 2): `roadmap_tool_rejected code=SEARCH_UNGROUNDED` silently ate a tool turn; research stage had one empty-response JSON failure (returned 0 chars) that repaired on retry.
- Positive: worker lifecycle, checkpointing, SSE events, tool governance and recoverable-vs-terminal error taxonomy all worked exactly as designed end-to-end.

## Verified working
- Signup + login + workspace auto-seed; workspace dashboard; "Start Learning Topic" creates a chat node and streams; "Quiz me" branch + side-peek split pane render correctly; jobs API CRUD + start + failure semantics; curriculum tables migrated cleanly.