# Node Collapse, Focus Mode, and Smart Minimap Implementation Plan

**Spec:** `docs/FEATURE_RESEARCH.md §7.4`  
**Agentic-worker sub-skill checklist:** `[ ]` read plan/AGENTS.md; `[ ]` inspect graph state; `[ ]` implement tickets sequentially; `[ ]` migrate/test; `[ ]` benchmark/a11y test; `[ ]` request review.  
**Goal:** reduce graph overload while never changing or hiding underlying knowledge truth.  
**Architecture:** per-user persisted view preferences plus derived virtual graph/collapse capsules.  
**Tech stack:** FastAPI/SQLAlchemy/Alembic/PostgreSQL, Next.js/React Flow/TypeScript/Vitest.  
**Global constraints:** AGENTS.md workflow applies; retain URL_DESIGN/central URL helpers; AI provider work stays in ai-core; migrations use Alembic; all endpoints use RBAC; shared semantic primitives/tokens and dark mode are mandatory; keyboard, focus, colour-independent state and reduced motion are required; no dead UI.

**Status:** partially present. `GraphCanvas.tsx` renders React Flow `MiniMap`, a heatmap, timeline replay, and layout controls, but has no persisted collapse state, branch-focus filter, summary-node model, or unexplored-zone semantics. `ThreadGraphNode.tsx` has no collapse control.

## Goal/non-goals and UX

Reduce cognitive load on large conversation graphs without deleting or rewriting nodes. A learner selects a branch and chooses **Collapse descendants**, **Expand**, or **Focus branch**. Collapse replaces descendants in the client render with one summary capsule (count, newest activity, mastery mix), never a fake database node. Focus dims non-branch nodes while preserving edges to avoid implying they vanished. Minimap shades visible/explored/unexplored using existing concept mastery only; it never uses colour as the only signal.

The state is per user/workspace/chat and syncs across sessions; it is not shared with collaborators, changes no learning/mastery values, and does not hide a node targeted by `?node=`—that path expands ancestors then focuses it.

## Design/evidence

React Flow's [performance guide](https://reactflow.dev/learn/advanced-use/performance) recommends rendering only what is needed and avoiding costly node updates. WCAG 2.2 requires an alternative to dragging, adequate target sizes, focus not obscured, and non-colour cues. The operational model is `GraphViewPreferences`, independent from graph truth: `{userId,workspaceId,chatId,collapsedRootIds:string[],focusRootId?:string,updatedAt,version}`. Derived `VisibleGraph` performs DFS with cycle guards and produces virtual collapse capsules; summary text is calculated from the existing node/concept data.

## Files/contracts/data flow

Create Alembic `apps/api/alembic/versions/20260921_0029_add_graph_view_preferences.py`, `apps/api/src/models/graph_view.py`, `schemas/graph_view.py`, `services/graph_view_service.py`, `routers/graph_view.py`, and tests. Modify `models/__init__.py`, `main.py`, `apps/web/src/components/canvas/GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `apps/web/src/lib/workspaceApi.ts`, `packages/shared/src/index.ts`, and `treeToGraph.ts`; create `apps/web/src/lib/graphViewApi.ts`, `hooks/useGraphViewPreferences.ts`, `components/canvas/GraphSummaryNode.tsx`, and tests. API: `GET|PUT /workspaces/{workspace_id}/chats/{chat_id}/graph-view-preferences`; PUT uses optimistic `version`, validates all IDs belong to the chat workspace, and returns 409 on conflict. `GET` is read; PUT is write RBAC.

## Safety, resilience, rollout

No user text is copied into preferences/logs. Put the labels/counts in accessible names; use `Button`, `Tooltip`, `Badge`, semantic colours and icons/patterns. Save after 500 ms, retry idempotently, retain in-memory state offline, and surface retry without losing local intent. Bound preference list to 500 roots; auto-normalize descendants when an ancestor is collapsed. Virtualise/minimize expensive subtrees and memoise the visible graph. Instrument `graph_view.collapse|expand|focus` and render P95/visible-count. Roll out client code first behind flag, then migration/API; a missing preference defaults to expanded.

## Tickets/tests/DoD

1. **API-741** preference model/migration/RBAC/versioning; test ownership, mismatch, conflicts, cascade cleanup.
2. **WEB-741** derived visible graph and summary node; test DFS cycles, deep branch, selected/deep-linked node expansion.
3. **WEB-742** focus/minimap/a11y; test keyboard control, reduced-motion, non-colour labels, focus return.
4. **PERF-741** benchmark 2k/10k nodes, prove interaction remains responsive and no full-tree re-render on viewport pan.

Run `uv run pytest apps/api/tests/test_graph_view*.py`, `uv run ruff check apps/api`, `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`. Done means preference persistence works with offline/conflict recovery, no graph data loss, deep links work, accessibility checks pass, and performance budget is documented.

## Research questions answered

1. **Persist collapse as nodes?** No; it is a viewer preference, not knowledge data.
2. **Replace descendants in DB?** No; use a client virtual capsule.
3. **Can focus delete edges?** No; dim them to retain topology truth.
4. **What does “unexplored” mean?** Existing `unexplored` mastery only, not guessed intent.
5. **Is colour sufficient?** No; icon/text/pattern are required alternatives.
6. **How does a deep link work?** Expand ancestors before centring the node.
7. **How prevent lost concurrent settings?** Versioned PUT and conflict merge/retry.
8. **How scale large graphs?** Derive/memoise only visible nodes and virtualise where React Flow supports it.

Sources: [React Flow performance](https://reactflow.dev/learn/advanced-use/performance), [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [URL contract](../URL_DESIGN.md), [OpenTelemetry events](https://opentelemetry.io/docs/specs/semconv/general/events/).

## Implementation-ready ticket expansion

### API-741 — view preference persistence

**Objective:** persist only viewer state with optimistic concurrency. **Create:** `apps/api/alembic/versions/20260921_0029_add_graph_view_preferences.py`, `apps/api/src/models/graph_view.py`, `apps/api/src/schemas/graph_view.py`, `apps/api/src/services/graph_view_service.py`, `apps/api/src/routers/graph_view.py`, `apps/api/tests/test_graph_view_preferences.py`. **Modify:** `apps/api/src/models/__init__.py`, `apps/api/src/main.py`, `packages/shared/src/index.ts`. **Dependencies:** existing user/workspace membership. **Flag/rollback:** `graph_view_preferences_v1`; turn off and default expanded, retaining harmless preferences.

1. Create table keyed by `user_id,workspace_id,chat_id` with JSONB collapsed roots, nullable focus root, `version`, timestamps and a unique composite index.
2. Validate all supplied roots are distinct, bounded to 500, and resolve in the requested workspace/chat before write.
3. Normalize roots by removing any collapsed descendant whose ancestor is also collapsed.
4. PUT uses `WHERE version=:expected` and increments version; return 409/current preference on conflict.
5. Add read/write RBAC, cascade cleanup, structured outcome telemetry and migration upgrade/downgrade tests.

Acceptance: (1) user A cannot read/write B’s preferences; (2) IDs from another workspace are rejected; (3) conflict cannot overwrite latest state; (4) delete workspace removes rows; (5) no graph node data changes. Run `uv run pytest apps/api/tests/test_graph_view_preferences.py`, `uv run ruff check apps/api`, `uv run mypy apps/api/src`.

### WEB-741 — virtual collapse renderer

**Objective:** derive visible React Flow nodes without changing graph truth. **Create:** `apps/web/src/lib/graphViewApi.ts`, `apps/web/src/hooks/useGraphViewPreferences.ts`, `apps/web/src/components/canvas/GraphSummaryNode.tsx`, `apps/web/src/components/canvas/__tests__/graph-canvas-collapse.test.tsx`, `apps/web/src/lib/__tests__/tree-to-graph-visibility.test.ts`. **Modify:** `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/components/canvas/treeToGraph.ts`, `apps/web/src/components/canvas/ThreadGraphNode.tsx`. **Dependencies:** API-741. **Flag/rollback:** hide collapse affordances and render original `treeToGraph` output.

1. Implement pure DFS `deriveVisibleGraph(tree, preferences)` with visited set, visible edge recomputation and virtual capsule data.
2. Keep collapsed capsule IDs namespaced (`collapse:${rootId}`) so no virtual ID reaches backend/node selection APIs.
3. Add collapse/expand/focus buttons using shared `Button`/tooltip and capability labels.
4. Debounce preference persistence, retain local state on transient error, merge 409 by reapplying current intent.
5. Expand ancestor chain before a selected/deep-linked node is focused.

Acceptance: (1) expand restores exact nodes/edges; (2) collapse never deletes server node; (3) focus dimming does not remove topology; (4) deep link works collapsed; (5) retry/conflict is visible. Tests: `tree-to-graph-visibility.test.ts`, `graph-canvas-collapse.test.tsx`; run `pnpm --filter @graphmind/web test` and build.

### WEB-742/PERF-741 — accessibility, minimap and scale

**Objective:** make controls interpretable and fast. **Create:** `apps/web/tests/e2e/graph-collapse-minimap.spec.ts`, `apps/web/tests/fixtures/graph-2000.json`, `apps/web/tests/fixtures/graph-10000.json`. **Modify:** `apps/web/src/components/canvas/GraphCanvas.tsx`, `apps/web/src/app/globals.css`. **Dependencies:** WEB-741. **Flag/rollback:** turn off minimap semantic layer independently.

1. Map existing mastery enum to text/icon/pattern and colours; label minimap zones and offer an equivalent accessible list.
2. Give collapse/focus controls keyboard names, visible focus and focus restoration; respect reduced motion.
3. Memoise visible graph and spatial data; avoid changing node object identities during pan/zoom.
4. Benchmark 2k/10k fixture graphs and record render/keyboard/fit-view time budgets.
5. Add Playwright + screen-reader manual check and metrics for collapse/focus render latency.

Acceptance: (1) colour is not sole minimap meaning; (2) all controls keyboard-operable; (3) 2k-node interactions meet budget; (4) no full tree render per pan; (5) flag rollback returns stable current canvas. Commands: `pnpm --filter @graphmind/web test`, `pnpm --filter @graphmind/web build`.

## Edge-case, rollout and backfill

| Case | Handling | Test |
|---|---|---|
| child and ancestor collapse request | retain ancestor only | `test_normalize_roots` |
| deleted root | prune preference/read default | `test_deleted_root` |
| 409 save | merge/retry local intent | `graph-view-api.test.ts` |
| timeline replay | apply preferences after replay cutoff | `graph-canvas-replay.test.tsx` |
| viewer role | may read own preference but no graph mutation | `test_viewer_preferences` |
| 10k graph | virtual render/memoized traversal | `graph-perf.spec.ts` |

Deploy migration/API behind flag → employee canvases → 10/50/100%. No historical backfill; absent rows mean expanded. Rollback disables flag/client fetch, leaving data unused and recoverable.
