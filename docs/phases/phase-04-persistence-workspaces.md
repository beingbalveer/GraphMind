# Phase 4: Workspace Persistence & Relational Storage

**Estimated Timeline:** 2 – 3 Weeks (~30 – 40 Engineering Hours @ 2 hrs/day)  
**Status:** Completed ✅  
**Goal:** Persist workspaces, graph nodes, edges, and spatial viewport positions to PostgreSQL using async SQLAlchemy and Alembic migrations.

---

## 1. Executive Summary

Phase 4 moves GraphMind from ephemeral browser state to full database persistence. Users can create distinct workspaces for different research projects, save complex graph topologies, reload sessions seamlessly, and export their knowledge graphs to Markdown, JSON, or Obsidian-compatible formats.

---

## 2. Relational Database Schema

```
[ workspaces ]
       │ 1
       ├───► N [ nodes ]
       │          │ 1
       │          └───► N [ children ]
       │
       └───► N [ edges ]
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 4.1: PostgreSQL & SQLAlchemy Async Architecture
*Estimated Time: 4 – 5 Days*

- [x] **Task 4.1.1 — SQLAlchemy 2.0 Async Setup**: Configured `async_engine`, session factory, and scoped async sessions using `asyncpg`.
- [x] **Task 4.1.2 — Core ORM Models**:
  - `Workspace`: `id`, `name`, `description`, `viewport_x`, `viewport_y`, `zoom`, `created_at`, `updated_at`.
  - `NodeModel`: `id`, `workspace_id`, `parent_id`, `role`, `content`, `highlighted_context`, `position_x`, `position_y`, `metadata`, `created_at`, `updated_at`.
  - `EdgeModel`: `id`, `workspace_id`, `source_id`, `target_id`, `relation_type`, `highlighted_context`, `created_at`.
- [x] **Task 4.1.3 — Database Synchronization**: Automated table creation and schema synchronization on FastAPI lifespan startup.

### Sub-Phase 4.2: Workspace & Graph REST CRUD APIs
*Estimated Time: 4 – 5 Days*

- [x] **Task 4.2.1 — Workspace Endpoints (`/api/v1/workspaces`)**: Create, list, get, update, and delete workspaces with cascading foreign keys.
- [x] **Task 4.2.2 — Graph State Endpoints (`/api/v1/workspaces/{id}/graph`)**:
  - Full graph snapshot retrieval (nodes, edges, viewport).
  - Delta update endpoint for batch saving node positions and edits.
- [x] **Task 4.2.3 — Auto-Save & Debounce**: Backend endpoint accepting debounced graph coordinate and state updates from the frontend.

### Sub-Phase 4.4: Frontend Workspace Management & Auto-Save
*Estimated Time: 4 – 5 Days*

- [x] **Task 4.4.1 — Workspace Switcher Modal**: UI to browse, search, create, and delete workspaces.
- [x] **Task 4.4.2 — Debounced Graph Auto-Save**: Debounced auto-save hook pushing delta updates to the API on tree changes.
- [x] **Task 4.4.3 — Save Status Indicator**: Visual indicator in the navbar (`Saved`, `Syncing...`, `Offline`).

### Sub-Phase 4.5: Export & Interoperability
*Estimated Time: 2 – 3 Days*

- [x] **Task 4.5.1 — JSON Graph Export / Import**: Full exportable JSON format for backup and migration.
- [x] **Task 4.5.2 — Obsidian Markdown Export**: Export graph branches into a formatted Markdown document with `[[wikilinks]]` compatible with Obsidian.

---

## 4. Exit & Acceptance Criteria

1. Workspaces, nodes, edges, and positions survive full browser refreshes and server restarts.
2. Node position changes auto-save within 600ms with visual status in the navbar.
3. Users can export their entire graph to Obsidian-compatible Markdown with backlinks or full JSON.
