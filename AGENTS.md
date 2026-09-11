# GraphMind — AI Assistant & Collaboration Rules

> **Purpose:** This file defines the mandatory working protocol, coding standards, and architectural rules for AI assistants (Antigravity, Claude Code, Cursor, Copilot) working in this repository.

---

## 1. Mandatory Collaboration Workflow

Every single task must follow this strict **3-step workflow**:

```
[ Step 1: Pick 1 Task & Explain ]
       │
       ▼
[ Step 2: Discuss & Agree on Implementation Approach ]
       │
       ▼ (User Approval Gate)
[ Step 3: Implement, Verify, & Commit ]
```

### Rule 1: One Task at a Time
- **Never implement multiple tasks at once.** Always focus strictly on the single active task from the current milestone in [`docs/ROADMAP.md`](./docs/ROADMAP.md).

### Rule 2: Explain & Propose Before Coding
- Before writing any code, explain the task clearly to the user.
- Propose the technical design, data structures, and trade-offs.
- Recommend the cleanest production-grade approach and ask for user alignment.

### Rule 3: Hard Approval Gate
- **Do not write code, edit files, or execute implementation until the user explicitly approves the design approach.**

### Rule 4: Implement, Test, and Verify
- After approval, implement the code cleanly.
- Run tests (`pytest`, `vitest`, `ruff`, `mypy`, `next build`) to ensure 100% verification.
- Provide a clear summary of what was accomplished and state the next task.

---

## 2. Core Project Principles (Non-Negotiable)

1. **Zero Dead UI Policy**: Never create mock buttons, placeholder UI panels, or premature features that belong to future phases (e.g. no 2D canvas until Phase 3).
2. **Progressive Evolution**: The app starts as a rock-solid, minimalist streamed AI chat (Phase 1), grows into a hierarchical tree (Phase 2), then a 2D spatial canvas (Phase 3), with persistence (Phase 4), semantic discovery (Phase 5), and multi-agent knowledge evolution (Phase 6).
3. **Build Interfaces, Not Implementations**: Decouple business logic from external LLM providers and frameworks (`packages/ai-core`).
4. **Observable & Production-Grade**: Every service must have structured logging, strict types, comprehensive error handling, and unit test suites.

---

## 3. Tech Stack & Standards

- **Backend**: Python 3.12+, FastAPI, `uv` package manager, SQLAlchemy (asyncpg), Alembic, Pydantic v2, `ruff`, `mypy`, `pytest`.
- **Frontend**: Next.js 15+ (App Router), TypeScript (strict), Tailwind CSS, `shadcn/ui`, `pnpm` workspaces, `vitest`.
- **Infrastructure**: Docker & Docker Compose (`docker-compose.yml`), PostgreSQL 16 (`pgvector`), Redis.
- **Git Conventions**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

---

## 4. URL Contract (Non-Negotiable)

**Read [`docs/URL_DESIGN.md`](./docs/URL_DESIGN.md) before touching any routing code.**

The canonical URL hierarchy is:

```
/w/{workspaceId}                          → Workspace landing
/w/{workspaceId}/chat/{chatId}            → Chat/thread view
/w/{workspaceId}/chat/{chatId}/canvas     → Canvas/graph view
```

### Mandatory URL Rules for All Agents

1. **Never use `window.history.replaceState` or `pushState` directly.** Use Next.js `router.push()` / `router.replace()`.
2. **Never put `chatId` or `workspaceId` in a query param for primary navigation.** They belong in the path.
3. **Never hardcode URL strings in components.** Import and use the helpers from `@/lib/urls`.
4. **Always redirect old `/graph/` and `/workspace/` routes** via `next.config.ts` — never remove those redirects.
5. **View mode (chat ↔ canvas) is a path segment**, not a query param or state variable stored in a cookie.

---

## 5. Mandatory Design Language & Common Component Protocol

To maintain a cohesive, accessible, and production-grade user experience, all AI agents must strictly adhere to the following design system rules:

### Rule 1: Always Use `@/components/ui/` Primitives
- **Never create raw `<button>` elements.** Use `<Button variant="..." size="...">` from `@/components/ui/button`.
- **Never hand-roll text or search inputs.** Use `<Input startIcon={<Icon />} ... />` from `@/components/ui/input`.
- **Never write custom modal/dialog overlays.** Use `<Modal>`, `<ModalHeader>`, `<ModalBody>`, and `<ModalFooter>` from `@/components/ui/modal`, or `<ConfirmDialog>` from `@/components/ui/confirm-dialog`.
- **Never build ad-hoc tab pills or mode switchers.** Use `<SegmentedTabs>` from `@/components/ui/segmented-tabs`.
- **Never build bespoke inline badges.** Use `<Badge variant="...">` from `@/components/ui/badge`.
- **Never reinvent dropdown menus.** Use `<DropdownMenu>` and `<MenuItem>` from `@/components/ui/dropdown-menu`.
- **Never build custom sliding side drawers.** Use `<Drawer>` from `@/components/ui/drawer`.

### Rule 2: Use Semantic Design Tokens, Never Hardcode Colors
- Use semantic utility classes generated from theme tokens:
  - Backgrounds: `bg-background`, `bg-background-secondary`, `bg-surface`, `bg-surface-hover`
  - Foregrounds / Text: `text-foreground`, `text-foreground-muted`
  - Borders: `border-border`, `border-border-subtle`
  - Brand & Status: `bg-primary text-primary-foreground`, `bg-destructive`, `bg-success`, `bg-warning`, `bg-info`
- Do **not** sprinkle random `zinc-900`, `zinc-50`, `#fbfbfb`, or arbitrary color classes in layout files unless defining theme variables in `globals.css`.

### Rule 3: Dark Mode Compliance by Default
- Every component must work in both light and dark modes.
- By using semantic tokens (`bg-surface`, `text-foreground`, `border-border`), components automatically adapt when `.dark` class is present. Avoid hardcoding `bg-white` or `text-zinc-900` without dark equivalents.

### Rule 4: Structural Dimensions & Typography Standards
- **Header Heights**: Standardized to `h-13` (52px / 3.25rem) across `Navbar`, `ChatSidebar`, `RightSidebar`, `TreeSidebar`, and `ModalHeader`.
- **Icon Buttons**: Use `size="iconSm"` (h-7 w-7) or `size="icon"` (h-8 w-8).
- **Cards & Containers**: Standard border radius is `rounded-2xl` for modals and cards, `rounded-xl` for inner widgets and lists, and `rounded-lg` for interactive controls.
- **Typography Scale**: Strictly use standard font sizing: `text-2xs` (10px), `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl` (20px). **Never use arbitrary brackets like `text-[10px]` or `text-[11px]`.**
- **Valid Tailwind Spacing**: Never invent invalid classes like `py-0.2` or `p-4.5`. Adhere strictly to the Tailwind spacing scale (`0`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `8`, etc.).


