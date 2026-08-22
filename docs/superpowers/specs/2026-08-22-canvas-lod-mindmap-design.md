# Design Specification: Level-of-Detail (LOD) Mind Map & Obsidian Galaxy Canvas

**Author:** Antigravity  
**Date:** 2026-08-22  
**Status:** Approved  
**Topic:** 2D Spatial Canvas Visualization Refactor  

---

## 1. Executive Summary

As conversation trees scale past 10–20+ turns, traditional large rectangular card nodes (`w-80`, height $>180\text{px}$) create heavy visual noise, overlap, and excessive scrolling on infinite 2D canvas viewports.

This specification redesigns the GraphMind 2D Spatial Canvas into an **Adaptive Level-of-Detail (LOD) Mind Map & Obsidian Galaxy Tree**:
- **Zoomed Out ($< 0.6\times$):** Nodes render as **Obsidian-Style Galaxy Orbs** (minimalist $28\text{px}$ circular nodes with role icons, subtle glowing lineage links, and hover tooltips) for bird's-eye spatial awareness of 100+ nodes.
- **Standard Zoom ($0.6\times - 1.2\times$):** Nodes render as **MindNode-Style Horizontal Topic Capsules** (~$38\text{px}$ height, $\le 220\text{px}$ width) with avatars, concise topic summaries, and branch excerpt quotes.
- **Close Zoom ($> 1.2\times$):** Capsules show enhanced metadata (branch counters `[🌿 2 branches]`, model tags, and excerpt badges).
- **Interactivity:** Clicking any node (orb or capsule) opens the **Focus Reader Drawer** for full Markdown rendering, KaTeX math, and inline follow-up prompting.

---

## 2. Architectural Design & Data Flow

```
[ ConversationTree ]
        │
        ▼ (treeToGraph.ts)
[ React Flow Nodes & Edges ]
        │
        ├───► [ GraphCanvas.tsx ] ──► Listens to Viewport Transform (Zoom Level)
        │                                      │
        ▼                                      ▼
[ MindMapNode.tsx ] ◄────────────── (zoomMode: "orb" | "capsule" | "detailed")
   ├── Orb View (< 0.6x)        ──► 28px circular dot with role glyph
   ├── Capsule View (0.6x-1.2x) ──► 38px horizontal capsule with summary
   └── Detailed View (> 1.2x)   ──► 48px capsule with branch count pills
```

---

## 3. Detailed Component Specifications

### 3.1 `MindMapNode.tsx` (Adaptive LOD Node)
- **Role Glyphs:**
  - User: `👤` in zinc-100 rounded badge.
  - Assistant: `🧠` in zinc-900 rounded badge with dark shadow.
- **Branch Lineage Pill:**
  - If node has `highlightedContext`, render `🌿 "excerpt"` in italic font.
- **Active State:**
  - High-contrast dark ring (`ring-2 ring-zinc-950/20`), active lineage accent, and subtle pulse when streaming.
- **Error State:**
  - Rose accent ring (`border-rose-400 bg-rose-50/20`) with 1-click retry button in capsule mode.

### 3.2 `MindMapEdge.tsx` (Organic Flowing Branch Curves)
- Smooth directed bezier curves linking parent output handles to child input handles.
- Active lineage edges are styled with crisp zinc-900 stroke (`stroke-width: 2px`) and subtle animated dash flow.
- Non-active lineage edges use low-contrast zinc-300 stroke (`stroke-width: 1.5px`).

### 3.3 `layoutEngine.ts` (Compact Left-to-Right Hierarchy)
- Layout engine configured with Left-to-Right (`LR`) default orientation (and Top-to-Bottom `TB` toggle).
- Node separation constants:
  - `nodesep: 32` (vertical spacing between sibling nodes).
  - `ranksep: 64` (horizontal spacing between generations).

---

## 4. Interaction Patterns

1. **Selection & Reading:** Single click on any node sets `activeDrawerNode` and opens `FocusDrawer.tsx`.
2. **Double Click:** Swaps viewport mode from `canvas` to `chat` centered on that turn.
3. **Shortcuts:**
   - `⌘0` / `Ctrl+0`: Fit whole graph into view.
   - `⌘.` / `Ctrl+.`: Center viewport on active node.
   - `⌘L` / `Ctrl+L`: Recompute compact Dagre auto-layout.

---

## 5. Verification Plan

1. **Unit & Integration Testing:**
   - `pnpm --filter @graphmind/shared test`: Shared tree model tests passing.
   - `uv run pytest`: Backend streaming and workspace endpoints passing.
2. **Static Analysis & Build:**
   - `pnpm --filter @graphmind/web lint`: 0 ESLint warnings.
   - `uv run mypy apps/api/src packages/ai-core/src`: 0 type errors.
   - `pnpm --filter @graphmind/web build`: Production Next.js build clean.
3. **Manual UX Verification:**
   - Test zoom out $<0.6\times$ &rarr; nodes smoothly become Obsidian orbs.
   - Test zoom in $>0.6\times$ &rarr; nodes smoothly expand to MindNode topic capsules.
   - Click node &rarr; Focus Drawer opens with full markdown.
