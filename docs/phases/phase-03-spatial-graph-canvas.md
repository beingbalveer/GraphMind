# Phase 3: The Spatial Graph Canvas (2D Visual Workspace)

**Estimated Timeline:** 3 – 4 Weeks (~40 – 50 Engineering Hours @ 2 hrs/day)  
**Status:** Completed ✅  
**Goal:** Elevate the conversation tree into an interactive, infinite 2D canvas powered by React Flow with custom node cards, auto-layout algorithms, and a focus reader drawer.

---

## 1. Executive Summary

Phase 3 transforms GraphMind into its true visual identity: an explorable knowledge canvas. Instead of a standard vertical list, conversation branches become cards in a 2D spatial canvas with directed relationship edges. To maintain high reading ergonomics, clicking any node expands a full Focus Drawer for deep reading and prompting.

---

## 2. Interaction Design: Canvas + Focus Drawer

```
+-------------------------------------------------------------------------------+
| Top Bar: Workspace Name | Auto-Layout | Minimap | Zoom: 100%                 |
+-------------------------------------------------------------------------------+
|                                            |                                  |
|   [Root Node: Python]                      |       FOCUS DRAWER (Right)       |
|            │                               |  +----------------------------+  |
|            ├───► [Node: Data Classes]      |  | # Python Data Classes      |  |
|            │            │                  |  |                            |  |
|            │            └──► [Node: Frozen]|  | Detailed explanation...    |  |
|            │                               |  | ```python                  |  |
|            └───► [Node: Metaclasses]       |  | @dataclass                 |  |
|                                            |  | class Point:...            |  |
|                                            |  | ```                        |  |
|                                            |  | [Type follow-up prompt...] |  |
|                                            |  +----------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 3.1: React Flow Canvas Integration & Viewport
*Estimated Time: 4 – 5 Days*

- [x] **Task 3.1.1 — React Flow Foundation**: Integrate `@xyflow/react` (React Flow 12+) with smooth pan, zoom, pinch gestures, and background grid pattern.
- [x] **Task 3.1.2 — Canvas Controls**: Zoom In/Out, Fit View, Minimap toggle, and Center-on-Active-Node helper.
- [x] **Task 3.1.3 — Performance & Virtualization**: Configure React Flow viewport culling for high-performance rendering with $100+$ nodes.

### Sub-Phase 3.2: Custom Node & Edge UI Components
*Estimated Time: 5 – 6 Days*

- [x] **Task 3.2.1 — Custom Node Card**: Build responsive node card displaying title, preview snippet, branch badge, token count, and action handles.
- [x] **Task 3.2.2 — Custom Animated Edges**: Directed bezier curves with animated gradient pulses during active streaming.
- [x] **Task 3.2.3 — Node Status Indicators**: Visual states for `idle`, `streaming`, `selected`, `has-children`, and `error`.

### Sub-Phase 3.3: Automatic Graph Layout (Dagre / ELK Engine)
*Estimated Time: 4 – 5 Days*

- [x] **Task 3.3.1 — Hierarchical Layout Engine**: Integrate `dagre` or `@elkjs/elkjs` to compute clean top-to-bottom and left-to-right tree layouts.
- [x] **Task 3.3.2 — Auto-Align on Branch Spawn**: Automatically reposition surrounding nodes when a new child node expands to prevent visual overlap.
- [x] **Task 3.3.3 — Layout Presets**: Provide user toggle between "Vertical (Top-to-Bottom)" and "Horizontal (Left-to-Right)" tree views.

### Sub-Phase 3.4: Dual-Mode UX: Canvas + Focus Reader Drawer
*Estimated Time: 5 – 6 Days*

- [x] **Task 3.4.1 — Side Reader Drawer**: Collapsible sliding panel displaying full Markdown, interactive code blocks, and conversation history of the active node.
- [x] **Task 3.4.2 — Inline Drawer Chatting**: Prompt input inside the focus drawer to continue conversation directly on the selected node.
- [x] **Task 3.4.3 — Highlight-to-Canvas Action**: Highlighting text inside the focus drawer creates a new connected node card on the canvas with animated zoom-to-fit.

### Sub-Phase 3.5: Keyboard Navigation & Command Palette
*Estimated Time: 3 – 4 Days*

- [x] **Task 3.5.1 — Spatial Navigation Shortcuts**: Traverse branches and trees with keyboard shortcuts (`Cmd+[`, `Cmd+]`, `Cmd+0`, `Cmd.`, `Cmd+L`).
- [x] **Task 3.5.2 — Quick Actions Command Menu**: `Cmd+K` palette to search nodes, trigger auto-layout, switch views, or create new root topics.

---

## 4. Exit & Acceptance Criteria

1. Conversations render on an infinite 2D canvas with clean hierarchical auto-layout.
2. Clicking a node opens the Focus Drawer with full markdown and active prompt input.
3. Spawning a new branch animates the new node card into position smoothly without layout collisions.
4. Canvas renders smoothly at 60 FPS across pan, zoom, and node dragging operations.
