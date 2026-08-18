# Phase 4: Workspace Persistence & Relational Storage

**Estimated Timeline:** 2 – 3 Weeks (~30 – 40 Engineering Hours @ 2 hrs/day)  
**Status:** Planned  
**Goal:** Persist workspaces, graph nodes, edges, and spatial viewport positions to PostgreSQL using async SQLAlchemy and Alembic migrations.

---

## 1. Executive Summary

Phase 4 moves GraphMind from ephemeral browser state to full database persistence. Users can create distinct workspaces for different research projects, save complex graph topologies, reload sessions seamlessly, and export their knowledge graphs to Markdown, JSON, or Obsidian-compatible formats.

---

## 2. Relational Database Schema

```
[ users ]
    │ 1
    └───► N [ workspaces ]
                 │ 1
                 ├───► N [ nodes ]
                 │          │ 1
                 │          └───► N [ messages ]
                 │
                 └───► N [ edges ]
```

---

## 3. Sub-Phases & Granular Tasks

### Sub-Phase 4.1: PostgreSQL & SQLAlchemy Async Architecture
*Estimated Time: 4 – 5 Days*

- [ ] **Task 4.1.1 — SQLAlchemy 2.0 Async Setup**: Configure `async_engine`, session factory, and scoped async sessions using `asyncpg`.
- [ ] **Task 4.1.2 — Core ORM Models**:
  - `User`: `id`, `email`, `hashed_password`, `created_at`.
  - `Workspace`: `id`, `user_id`, `name`, `description`, `viewport_x`, `viewport_y`, `zoom`.
  - `Node`: `id`, `workspace_id`, `parent_id`, `title`, `node_type`, `position_x`, `position_y`, `created_at`.
  - `Edge`: `id`, `workspace_id`, `source_id`, `target_id`, `relation_type`.
  - `Message`: `id`, `node_id`, `role`, `content`, `tokens`, `created_at`.
- [ ] **Task 4.1.3 — Alembic Migrations**: Setup version-controlled schema migrations with auto-migration generation scripts.

### Sub-Phase 4.2: Workspace & Graph REST CRUD APIs
*Estimated Time: 4 – 5 Days*

- [ ] **Task 4.2.1 — Workspace Endpoints (`/api/v1/workspaces`)**: Create, list, get, update, and delete workspaces.
- [ ] **Task 4.2.2 — Graph State Endpoints (`/api/v1/workspaces/{id}/graph`)**:
  - Full graph snapshot retrieval (nodes, edges, viewport).
  - Delta update endpoint for batch saving node positions and edits.
- [ ] **Task 4.2.3 — Auto-Save & Debounce**: Backend endpoint accepting debounced graph coordinate and state updates from the frontend.

### Sub-Phase 4.3: User Authentication & JWT Security
*Estimated Time: 3 – 4 Days*

- [ ] **Task 4.3.1 — Password Hashing & JWT**: Secure password hashing with `argon2` or `bcrypt`, access/refresh token generation.
- [ ] **Task 4.3.2 — Auth Endpoints (`/api/v1/auth`)**: Signup, login, refresh, logout, and `/me` routes.
- [ ] **Task 4.3.3 — FastAPI Security Dependencies**: `get_current_user` dependency enforcing authentication and workspace ownership.

### Sub-Phase 4.4: Frontend Workspace Management & Auto-Save
*Estimated Time: 4 – 5 Days*

- [ ] **Task 4.4.1 — Workspace Switcher Modal**: UI to browse, search, create, and delete workspaces.
- [ ] **Task 4.4.2 — Debounced Graph Auto-Save**: Zustand middleware sending delta updates to the API whenever nodes are moved or edited.
- [ ] **Task 4.4.3 — Save Status Indicator**: Visual indicator in the navbar (`Saved`, `Saving...`, `Offline`).

### Sub-Phase 4.5: Export & Interoperability
*Estimated Time: 2 – 3 Days*

- [ ] **Task 4.5.1 — JSON Graph Export / Import**: Full exportable JSON format for backup and migration.
- [ ] **Task 4.5.2 — Obsidian Markdown Export**: Export graph branches into a folder of Markdown files with `[[wikilinks]]` compatible with Obsidian.
- [ ] **Task 4.5.3 — Image / PDF Export**: Export active canvas view as PNG or SVG.

---

## 4. Exit & Acceptance Criteria

1. Workspaces, nodes, edges, and positions survive full browser refreshes and server restarts.
2. User authentication protects workspace data isolation.
3. Node position changes auto-save within 500ms without UI stutter.
4. Users can export their entire graph to a ZIP of Markdown files with Obsidian-compatible backlinks.
