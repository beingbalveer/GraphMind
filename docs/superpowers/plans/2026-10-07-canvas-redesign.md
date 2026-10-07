# Shared Canvas Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing conversation canvas with the approved central path and side-group design while preserving real conversations and working canvas controls.

**Architecture:** Project conversation messages into stable segments without changing the underlying tree. A shared React Flow renderer consumes a typed visual graph and measured layout; conversation and curriculum adapters supply their own semantics. Persist layout independently of message coordinates, keyed by workspace, chat and layout version.

**Tech Stack:** Next.js 15, React 19, strict TypeScript, Tailwind semantic tokens, existing UI primitives, React Flow 12, Vitest, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16, pytest, uv, pnpm.

**Spec:** [Approved design](../specs/2026-10-07-roadmap-generator-design.md), especially sections 3, 4.6, 8.1, 9 and 10.

**Next plan:** [Roadmap generator](2026-10-07-roadmap-generator.md). Finish this plan before introducing the generator UI.

## Global Constraints

- One active implementation task; explain its approach, implement after alignment, verify and commit before moving on.
- Preserve the approved preview's appearance. Color literals belong in theme definitions.
- Retain 52px headers, 8px control corners, 12px cards/groups, and 16px outer containers.
- Use system sans-serif for controls and content; Georgia/serif display treatment for roadmap titles and learning briefs.
- No raw product buttons, custom dialog overlays, bespoke drawers or ad-hoc view switchers; use `@/components/ui/` primitives.
- No galaxy/orb styling, glowing connections, large metadata badges, or a permanently expanded control toolbar as the default canvas experience.
- Zoom, streaming tokens, and progress updates do not reset positions or reflow the entire graph.
- Preserve pan, zoom, fit, selection, drag, detail panels, branch deletion confirmation, keyboard behavior, mastery and timeline access.
- Use URL helpers and Next router; preserve existing legacy redirects. Do not change the canonical workspace/chat/canvas hierarchy.
- No roadmap placeholder buttons appear during this independently usable canvas release.

## Review Focus

1. Selecting a nested branch must highlight it without promoting it to the central path — task 2.
2. Long content, missing children and old malformed timestamps must not erase valid conversation messages or create overlapping cards — tasks 2 and 3.
3. Streaming, zoom changes and opening a drawer must preserve manual positions — task 4.
4. Old saved positions and a failed new-layout save must leave old data recoverable — task 5.
5. A test command targeting the live database must stop before connections or destructive cleanup — task 1.

---

## File map and contracts

| File | Responsibility |
| --- | --- |
| `apps/api/tests/conftest.py` | Guard and isolate integration tests; remove live-workspace cleanup. |
| `apps/api/tests/test_test_database_guard.py` | Test guard in a subprocess without connecting to PostgreSQL. |
| `apps/web/src/lib/canvas/types.ts` | Shared visual graph, layout and render contracts. |
| `apps/web/src/lib/canvas/conversationProjection.ts` | Mainline segmentation and actual branch-origin mapping. |
| `apps/web/src/lib/canvas/spineLayout.ts` | Deterministic measured central-spine/side-group placement. |
| `apps/web/src/lib/treeToGraph.ts` | Compatibility facade while callers migrate. |
| `apps/web/src/components/canvas/CanvasSurface.tsx` | React Flow mechanics independent of graph domain. |
| `apps/web/src/components/canvas/CanvasCard.tsx` | Named compact card and selected/streaming state. |
| `apps/web/src/components/canvas/CanvasControls.tsx` | Fit plus optional advanced controls. |
| `apps/web/src/components/canvas/GraphCanvas.tsx` | Conversation adapter and existing public callbacks. |
| `apps/web/src/components/canvas/ThreadGraphNode.tsx` | Conversation card wrapper, confirmations and handles. |
| `apps/web/src/lib/canvas/layoutState.ts` | Position reconciliation, version and topology keys. |
| `apps/web/src/hooks/useCanvasLayout.ts` | Debounced persistence and save feedback. |
| `apps/api/src/models/canvas.py` / `schemas/canvas.py` | Authenticated per-chat typed layout persistence. |
| `apps/api/src/routers/canvas.py` / `services/canvas_service.py` | Read/write layout without changing conversation nodes. |
| `apps/api/alembic/versions/20261007_0002_add_canvas_layouts.py` | Additive migration after `20260911_0001`. |

All new canvas utility tests live in `apps/web/src/lib/canvas/__tests__/`; component tests live in `apps/web/src/components/canvas/__tests__/`. Existing `layoutEngine.ts` remains available until its other consumers are checked; do not refactor unrelated graph features.

### Task 1: Make backend verification safe and reproducible

**Files:** Modify `apps/api/tests/conftest.py`; create `apps/api/tests/test_test_database_guard.py`; modify `docs/ROADMAP.md` and `README.md` with the active canvas milestone and isolated test instructions.

**Interfaces:** Produces `assert_test_database_url(url: str) -> None` in conftest. The guard runs before importing `database` or initializing the engine. Test database names must end in `_test`, and `ENVIRONMENT` must be `test`; absence of either fails immediately. This task provides the fixture boundary required by every later backend task.

- [ ] Write this subprocess regression in `test_test_database_guard.py`:

```python
import os
import subprocess
import sys
from pathlib import Path


def test_live_database_is_rejected_before_database_import():
    env = dict(os.environ, ENVIRONMENT="test")
    env["DATABASE_URL"] = "postgresql+asyncpg://x:x@127.0.0.1:1/graphmind"
    fixture = Path(__file__).with_name("conftest.py")
    result = subprocess.run(
        [sys.executable, "-c", f"import runpy; runpy.run_path({str(fixture)!r})"],
        env=env, capture_output=True, text=True, check=False,
    )
    assert result.returncode != 0
    assert "isolated *_test database" in result.stderr
    assert "Connection refused" not in result.stderr
```

- [ ] Run the regression directly, avoiding the unsafe parent fixture: `uv run python -c 'import runpy; m=runpy.run_path("apps/api/tests/test_test_database_guard.py"); m["test_live_database_is_rejected_before_database_import"]()'`. Expect failure because current conftest does not reject the URL.
- [ ] Put this guard before database imports, then replace hardcoded primary-workspace preservation with cleanup confined to the isolated database:

```python
import os
from sqlalchemy.engine import make_url


def assert_test_database_url(url: str) -> None:
    database_name = make_url(url).database or ""
    if os.environ.get("ENVIRONMENT") != "test" or not database_name.endswith("_test"):
        raise RuntimeError("Backend tests require an isolated *_test database")


assert_test_database_url(os.environ.get("DATABASE_URL", "postgresql:///graphmind"))
```

After the guard, explicitly import `models` before Base.metadata.create_all so all registered tables, including future canvas/roadmap models, exist in the isolated fixture database. Do not let Python import order decide table availability.

- [ ] Start a dedicated test database if it is absent: `docker run --name graphmind-roadmap-tests -e POSTGRES_USER=graphmind -e POSTGRES_PASSWORD=graphmind_test_only -e POSTGRES_DB=graphmind_test -p 15432:5432 -d pgvector/pgvector:pg16`. If that exact container already exists, inspect/start it instead of recreating it. Use `docker exec graphmind-roadmap-tests pg_isready -U graphmind -d graphmind_test` for readiness. Set `GRAPHMIND_TEST_DATABASE_URL=postgresql+asyncpg://graphmind:graphmind_test_only@localhost:15432/graphmind_test` in the execution shell.
- [ ] Run `ENVIRONMENT=test DATABASE_URL="$GRAPHMIND_TEST_DATABASE_URL" uv run pytest apps/api/tests/test_test_database_guard.py -q`; expect pass. Run the current full backend and frontend suites once to record the baseline. Record existing failures accurately; do not label them passing.
- [ ] Document the single active canvas task in ROADMAP and test commands in README. Commit these four files with `test: isolate backend verification from user workspaces`.

### Task 2: Project main conversation segments and true branch origins

**Files:** Create `lib/canvas/types.ts`, `lib/canvas/conversationProjection.ts`, `lib/canvas/__tests__/conversationProjection.test.ts`; modify `lib/treeToGraph.ts` only as a compatibility facade. Paths are under `apps/web/src/`.

**Interfaces:**

```ts
export interface CanvasItem {
  id: string;
  kind: "milestone" | "group" | "topic" | "conversation";
  title: string;
  summary?: string;
  itemIds: string[];
  selectionId: string;
  lane: "spine" | "side";
  parentId: string | null;
  originId: string | null;
  order: number;
}
export interface CanvasLink {
  id: string; source: string; target: string;
  kind: "sequence" | "containment" | "prerequisite" | "alternative";
}
export interface CanvasGraph { items: CanvasItem[]; links: CanvasLink[] }
export interface CanvasBounds { width: number; height: number }
export interface CanvasPoint { x: number; y: number }
export interface CanvasLayout {
  version: "spine-v1";
  positions: Record<string, CanvasPoint>;
  viewport: { x: number; y: number; zoom: number } | null;
  topologyKey: string;
}
export function projectConversation(tree: ConversationTree): CanvasGraph;
```

`projectConversation` is independent of active selection, streaming text and zoom. `selectionId` names the segment's last existing message; `itemIds` names every message in that segment. Segments split after each branch-origin message. Side threads are segmented using the same rule. IDs use `segment:<firstMessageId>`; existing messages are never rewritten.

- [ ] Write a fixture with mainline `r → a → b`, branch `a → x` with highlighted context, and nested branch `x → y`. Assert all five messages occur exactly once:

```ts
it("keeps nested selection off the central spine", () => {
  const node = (id: string, parentId: string | null, childrenIds: string[], highlightedContext?: string) =>
    ({ id, parentId, childrenIds, highlightedContext, role: "assistant" as const,
       content: id, createdAt: "2026-10-07T00:00:00Z" });
  const tree: ConversationTree = {
    id: "w", rootNodeId: "r", activeNodeId: "y", createdAt: "", updatedAt: "",
    nodes: { r: node("r", null, ["a"]), a: node("a", "r", ["b", "x"]),
      b: node("b", "a", []), x: node("x", "a", ["y"], "branch"),
      y: node("y", "x", [], "nested") },
  };
  const graph = projectConversation(tree);
  expect(graph.items.filter(i => i.lane === "spine").flatMap(i => i.itemIds)).toEqual(["r", "a", "b"]);
  expect(graph.items.find(i => i.itemIds.includes("x"))?.originId).toBe("a");
  expect(graph.items.find(i => i.itemIds.includes("y"))?.originId).toBe("x");
  expect(graph.items.flatMap(i => i.itemIds).sort()).toEqual(["a", "b", "r", "x", "y"]);
  expect(projectConversation({ ...tree, activeNodeId: "b" })).toEqual(graph);
});
```

- [ ] Run `pnpm --filter @graphmind/web test src/lib/canvas/__tests__/conversationProjection.test.ts`; expect missing module failure.
- [ ] Use `extractConversationThreads` from `threadUtils.ts` to identify the unchanged original mainline; construct an origin-to-segment lookup, then attach each side segment to the segment containing its `sourceMessageId`. The central algorithm is:

```ts
const branchOrigins = new Set(threads.flatMap(t => t.sourceMessageId ? [t.sourceMessageId] : []));
const chunks: TreeNode[][] = [];
let chunk: TreeNode[] = [];
for (const message of thread.messages) {
  chunk.push(message);
  if (branchOrigins.has(message.id)) { chunks.push(chunk); chunk = []; }
}
if (chunk.length) chunks.push(chunk);
```

- [ ] Add explicit missing-child and cycle guards to `threadUtils.ts`: traverse only existing children, keep a visited-message set, stop a repeated edge while retaining already visited valid messages. Timeline filtering retains root and valid ancestor chains; malformed timestamps are treated as visible undated messages, not silently deleted. Add tests to the same file for missing child IDs, a corrupt cycle, and invalid timestamps.
- [ ] Run projection tests and `pnpm --filter @graphmind/shared test`. Expect deterministic projection and unchanged deletion/ancestor semantics. Commit the listed files and targeted `threadUtils.ts` change with `feat: project conversation segments around branch origins`.

### Task 3: Build measured spine layout and approved shared card styling

**Files:** Create `lib/canvas/spineLayout.ts`, `lib/canvas/__tests__/spineLayout.test.ts`, `components/canvas/CanvasCard.tsx`; modify `app/globals.css`; create `components/canvas/__tests__/canvas-card.test.tsx`.

**Interfaces:** `layoutSpine(graph: CanvasGraph, bounds: Record<string, CanvasBounds>) -> CanvasLayout`. Cards expose `CanvasCard({item, selected, streaming, onSelect}: {item: CanvasItem; selected: boolean; streaming: boolean; onSelect: (id: string) => void})`. Default width is 260 for central cards and 300 for groups; actual measured dimensions take precedence. Layout places the central sequence first, then computes each side subtree's height bottom-up and reserves a non-overlapping vertical band beside its origin. Gaps: central row 40px, lanes 72px, side cards 16px; these are layout geometry, not arbitrary Tailwind utilities.

- [ ] Write this non-overlap test plus a nested-side-subtree case using the task 2 types:

```ts
it("reserves the whole measured side subtree", () => {
  const item = (id: string, lane: "spine" | "side", parentId: string | null, order: number): CanvasItem =>
    ({ id, kind: "group", title: id, itemIds: [id], selectionId: id, lane,
       parentId, originId: parentId, order });
  const graph: CanvasGraph = { items: [item("a", "spine", null, 0),
    item("b", "spine", "a", 1), item("x", "side", "a", 0), item("y", "side", "b", 0)], links: [] };
  const bounds = { a: { width: 260, height: 80 }, b: { width: 260, height: 80 },
    x: { width: 300, height: 400 }, y: { width: 300, height: 150 } };
  const layout = layoutSpine(graph, bounds);
  expect(layout.positions.y.y).toBeGreaterThanOrEqual(layout.positions.x.y + 416);
  expect(layout.positions.a.x).toBe(layout.positions.b.x);
  expect(layoutSpine(graph, bounds)).toEqual(layout);
});
```

- [ ] Run the new layout test; expect missing implementation failure.
- [ ] Implement recursive subtree height with a visiting set, rank roots by stable `order` then `id`, and reserve lane intervals. Use measured group bounds, not Dagre's current fixed 230×52 assumption. Produce a topology key from IDs, parent/origin, order and relation kinds, excluding content/progress/selection. Empty graph returns empty positions and null viewport. Do not persist measured dimensions as curriculum data.
- [ ] Define these theme roles in `globals.css`, with dark equivalents using existing semantic palette contrast conventions:

```css
/* Light theme; expose matching --color-* entries in existing @theme mapping. */
--canvas-background: #f3f3f1;
--canvas-milestone: #e7e7e2;
--canvas-topic: #ffffff;
--canvas-group: #f8f8f7;
--canvas-connector: rgb(0 0 0 / 24%);
--roadmap-switch: #ecece9;
--font-roadmap-display: Georgia, "Times New Roman", serif;
--text-roadmap-title: 2.125rem;
--text-canvas-title: 1.625rem;
--text-brief-title: 1.6875rem;
```

- [ ] Implement the card using `Button variant="ghost"` as its accessible selection surface, standard `text-sm`/`text-xs`, semantic backgrounds, `rounded-xl`, and named display tokens. Title remains visible at low zoom. Large summaries clamp inside a fixed-height preview; expanded group measurement changes only on explicit expansion. Test selection via Enter and a long multiline title; verify readable dark-mode colors by browser inspection.
- [ ] Run both new test files and existing canvas primitive-compliance tests; expect pass. Compare the card to the approved HTML. Commit these files with `feat: add shared spine layout and approved canvas cards`.

### Task 4: Replace the live canvas renderer without layout churn

**Files:** Create `components/canvas/CanvasSurface.tsx`, `CanvasControls.tsx`, `lib/canvas/layoutState.ts`, `lib/canvas/__tests__/layoutState.test.ts`, `components/canvas/__tests__/canvas-interactions.test.tsx`; modify `GraphCanvas.tsx`, `ThreadGraphNode.tsx`, `MindMapEdge.tsx`, `components/chat/ChatContainer.tsx` and `components/layout/Navbar.tsx` where existing canvas controls are wired.

**Interfaces:** `CanvasSurface` consumes `graph: CanvasGraph`, `renderItem: (item: CanvasItem) => React.ReactNode`, `layout: CanvasLayout`, `onLayoutChange: (layout: CanvasLayout) => void`, `onSelect: (selectionId: string) => void`, `onPaneClick?: () => void`, `sidePanelWidth: number`, and `advancedControls?: React.ReactNode`. It supplies real React Flow controls. Preserve all `GraphCanvasProps` callback/ref names. `reconcilePositions(current: CanvasLayout, generated: CanvasLayout, bounds?: Record<string,CanvasBounds>) -> CanvasLayout` retains positions for existing IDs and supplies collision-free coordinates for new IDs; explicit Auto layout replaces all positions.

- [ ] Write the state regression:

```ts
it("retains a dragged card when streaming changes its summary", () => {
  const current: CanvasLayout = { version: "spine-v1", topologyKey: "a",
    viewport: { x: 20, y: 30, zoom: 0.8 }, positions: { a: { x: 600, y: 900 } } };
  const generated: CanvasLayout = { ...current, positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 120 } } };
  expect(reconcilePositions(current, generated)).toEqual({ ...generated,
    viewport: current.viewport, positions: { a: { x: 600, y: 900 }, b: { x: 0, y: 120 } } });
});
```

- [ ] Run the new state test; expect missing implementation failure.
- [ ] Implement reconciliation with this preservation boundary:

```ts
export function reconcilePositions(current: CanvasLayout, generated: CanvasLayout,
  bounds: Record<string, CanvasBounds> = {}): CanvasLayout {
  const positions: Record<string, CanvasPoint> = {};
  const size = (id: string) => bounds[id] ?? { width: 300, height: 88 };
  for (const id of Object.keys(generated.positions)) {
    if (current.positions[id]) positions[id] = current.positions[id];
  }
  for (const [id, initial] of Object.entries(generated.positions)) {
    if (positions[id]) continue;
    const point = { ...initial };
    let overlapping: [string, CanvasPoint] | undefined;
    do {
      overlapping = Object.entries(positions).find(([other, p]) =>
        point.x < p.x + size(other).width + 16 && point.x + size(id).width + 16 > p.x &&
        point.y < p.y + size(other).height + 16 && point.y + size(id).height + 16 > p.y);
      if (overlapping) point.y = overlapping[1].y + size(overlapping[0]).height + 16;
    } while (overlapping);
    positions[id] = point;
  }
  return { ...generated, viewport: current.viewport, positions };
}
```

- [ ] Feed projection into `CanvasSurface`; separate `setNodes` content updates from position updates. Layout only after graph topology changes, explicit group expansion or Auto layout. Stream content updates use existing node positions. Use measured node bounds after React Flow initialization; fit once on initial new layout. Opening a drawer changes fit padding only on an explicit fit action and must not reset the viewport.
- [ ] Replace orb/capsule zoom thresholds with named-group simplification. Keep actual source/target handles and muted semantic connectors. Clicking any message segment selects its last message; branch delete resolves to the true thread root, retains `ConfirmDialog`, and never treats a segment as a new database branch. Keep `onExploreBranch`, switch-to-chat and retry actions where they work today.
- [ ] Put minimap, mastery, timeline, layout and center-active into `DropdownMenu`; default minimap/mastery/timeline off. Fit and basic navigation stay visible. Lazy-load mastery/timeline only when requested. Timeline is a read-only projection and never saves its filtered layout over the live layout.
- [ ] Test through mocked React Flow callbacks: select nested branch, drag→stream→zoom→open drawer, delete confirmed/canceled, Auto layout, timeline enter/exit, fit/center ref callbacks, empty/error state and keyboard activation. Assert the state regression and original callbacks, not snapshots of CSS markup.
- [ ] Add a new-node collision regression: drag existing a to generated b's position, reconcile with a measured 300×200 bound, assert a stays fixed and b is placed at least 216px below a. Existing manually overlapping nodes are preserved; new nodes must avoid them.
- [ ] Run canvas tests, frontend typecheck and existing chat interaction tests. Inspect real localhost:3300 with one root, two branches and a nested branch; capture light/dark and narrow/wide screenshots against the preview. Commit these files with `feat: replace conversation canvas with the shared spine view`.

### Task 5: Persist versioned layouts and finish conversation regression checks

**Files:** Create `apps/api/src/models/canvas.py`, `schemas/canvas.py`, `services/canvas_service.py`, `routers/canvas.py`, `apps/api/alembic/versions/20261007_0002_add_canvas_layouts.py`, `apps/api/tests/test_canvas_layout.py`; modify `apps/api/src/models/__init__.py`, `main.py`; create `apps/web/src/hooks/useCanvasLayout.ts`, `lib/canvasApi.ts`, `hooks/__tests__/useCanvasLayout.test.tsx`; modify `GraphCanvas.tsx`, `docs/ROADMAP.md`, `docs/URL_DESIGN.md`.

**Interfaces:** Authenticated GET/PUT `/api/v1/workspaces/{workspace_id}/chats/{chat_id}/canvas-layout` with auxiliary `kind=conversation|curriculum` query, default conversation. `CanvasLayoutModel` key `(workspace_id, chat_id, graph_kind)`; `graph_kind` is `conversation` or `curriculum`. Columns `layout_version`, `positions` JSON, `viewport` JSON, `topology_key`, `revision` integer, timestamps. `PUT` consumes `{baseRevision, layout: CanvasLayout}`, returns `{layout, revision}`; stale writes return 409. Missing layout returns `{layout:null,revision:0}`. Validate chat root belongs to workspace. No changes to NodeModel coordinates or existing workspace viewport.

`readCanvasLayout(workspaceId: string, chatId: string, kind: "conversation" | "curriculum") -> Promise<{layout: CanvasLayout | null; revision: number}>`; `writeCanvasLayout(workspaceId, chatId, kind, baseRevision: number, layout: CanvasLayout) -> Promise<{layout: CanvasLayout; revision: number}>`. `useCanvasLayout` returns `{layout, setLayout, saveState: "saved" | "saving" | "error", retrySave}` and debounces moves/viewport updates 500ms.

- [ ] Add backend tests using task 1 isolation for mismatched chat/workspace, unauthorized member, first create, stale write and rollback. Add frontend regression:

```ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { readCanvasLayout, writeCanvasLayout } from "@/lib/canvasApi";
import { useCanvasLayout } from "@/hooks/useCanvasLayout";
import type { CanvasLayout } from "@/lib/canvas/types";

vi.mock("@/lib/canvasApi", () => ({ readCanvasLayout: vi.fn(), writeCanvasLayout: vi.fn() }));
beforeEach(() => {
  vi.mocked(readCanvasLayout).mockResolvedValue({ layout: null, revision: 0 });
  vi.mocked(writeCanvasLayout).mockReset();
});

it("keeps the new draft and old stored layout when save fails", async () => {
  const { result } = renderHook(() => useCanvasLayout("w", "c", "conversation"));
  await waitFor(() => expect(result.current.saveState).toBe("saved"));
  const next: CanvasLayout = { version: "spine-v1", topologyKey: "a",
    viewport: null, positions: { a: { x: 20, y: 30 } } };
  vi.mocked(writeCanvasLayout).mockRejectedValueOnce(new Error("offline"));
  act(() => result.current.setLayout(next));
  await waitFor(() => expect(result.current.saveState).toBe("error"));
  expect(result.current.layout).toEqual(next);
  expect(writeCanvasLayout).toHaveBeenCalledWith("w", "c", "conversation", 0, next);
});
```

- [ ] Run targeted tests; expect missing endpoint/hook failure.
- [ ] Add model/migration and optimistic write inside a short transaction. Core update:

```python
result = await session.execute(
    update(CanvasLayoutModel)
    .where(CanvasLayoutModel.workspace_id == workspace_id,
           CanvasLayoutModel.chat_id == chat_id,
           CanvasLayoutModel.graph_kind == graph_kind,
           CanvasLayoutModel.revision == base_revision)
    .values(layout_version=layout.version, positions=layout.positions,
            viewport=layout.viewport, topology_key=layout.topology_key,
            revision=base_revision + 1)
    .returning(CanvasLayoutModel.revision)
)
if result.scalar_one_or_none() is None:
    raise HTTPException(409, "Canvas layout changed; reload before saving")
```

For the first write, insert under the composite unique key and translate concurrent unique conflict into 409. Pydantic limits: maximum 2,000 position entries, finite coordinates and positive zoom 0.05–4.0. Authorize reads with `require_workspace_read`, writes with `require_workspace_write`.

- [ ] Wire the hook; ignore missing/older layout versions, generate and fit the new layout, then save it. Old node coordinates/workspace viewport remain untouched. Distinguish offline save failure from load failure; offer Retry save. Prevent saving an empty transient graph before data loading completes. On 409 fetch latest and offer reload rather than overwriting another tab's positions.
- [ ] Apply additive migration in the isolated DB, test upgrade/downgrade there, run all canvas/backend regression tests, ruff, mypy, shared/frontend tests and frontend typecheck. Run `next build` in an isolated checkout/output so the live dev server's `.next` is preserved. Record any baseline failures separately.

Migration verification uses a second disposable database named `graphmind_migration_test`, not the create_all fixture database. Initialize only pre-canvas metadata tables, then run Alembic upgrade/downgrade/upgrade and inspect new constraints. Do not initialize future tables through create_all before asserting their migrations. The same `_test` URL guard applies.
- [ ] Update URL_DESIGN with auxiliary layout endpoint only; canonical page hierarchy/redirects remain intact. Mark canvas delivery complete in ROADMAP only after browser verification. Commit exact task files with `feat: persist versioned canvas layouts without changing conversations`.

## Acceptance and handoff

- Existing conversations, branch origins, streaming, follow-ups and deletion semantics still work.
- Mainline stays central when selecting branches; nested branches retain actual parentage.
- Approved preview palette/card shape/typography is reproduced in real React Flow, with accessible dark mode.
- Manual positions survive normal rerenders, refresh and save retries; migration never overwrites old coordinates.
- Advanced controls remain functional and collapsed by default.
- No roadmap UI has been exposed before its backend is ready.

Task 5 completes this independently usable canvas release. Continue to the linked roadmap plan only after its task-level alignment.
