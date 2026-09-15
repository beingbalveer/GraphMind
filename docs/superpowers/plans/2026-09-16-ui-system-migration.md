# UI System Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every visible GraphMind surface with the shared source-distributed design system while preserving feature behavior.

**Architecture:** First migrate the shared primitive layer, then replace legacy consumers by surface family. All application code imports local `@/components/ui/*` primitives; those primitives own visual source, keyboard behavior, overlays, and semantic tokens.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Base UI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-16-ui-system-migration-design.md`

## Global Constraints

- Preserve routes, APIs, and feature semantics.
- Use semantic tokens only in application surfaces.
- Use shared primitives for every interactive control and overlay.
- Keep source free of the upstream product name.

---

### Task 1: Complete shared primitives

**Files:** `apps/web/src/components/ui/{input,textarea,switch,badge,segmented-tabs,dropdown-menu,modal,drawer,tooltip,toast,skeleton,feedback}.tsx`; corresponding `__tests__`.

- [ ] Write failing tests for focus, disabled, error, loading, dark-token, and keyboard behavior of each primitive.
- [ ] Run the focused primitive tests and verify failures represent legacy behavior.
- [ ] Replace each primitive with the official source structure backed by Base UI, retaining only GraphMind compatibility props.
- [ ] Run `pnpm --filter @graphmind/web exec vitest run src/components/ui/__tests__` and `pnpm --filter @graphmind/web typecheck`.
- [ ] Commit the primitive migration.

### Task 2: Migrate the workspace shell and workspace surfaces

**Files:** `components/layout/*`, `components/workspace/*`, and their tests.

- [ ] Write failing behavior tests for shell navigation, workspace selection, user menu, loading, empty, and error states.
- [ ] Replace legacy segmented controls, menus, cards, and overlays with Task 1 primitives.
- [ ] Verify keyboard navigation and route behavior with existing tests plus a browser walkthrough.
- [ ] Commit the shell and workspace migration.

### Task 3: Migrate chat and learning surfaces

**Files:** `components/chat/*`, `components/flashcards/*`, and tests.

- [ ] Write failing tests for composer controls, message actions, branch menus, sheets, viewers, flashcards, loading, and destructive confirmations.
- [ ] Replace surface-level visual controls with shared primitives; remove duplicate styles without changing streaming or branching state.
- [ ] Run chat and flashcard tests, typecheck, and browser walkthroughs for chat, branch, and flashcard states.
- [ ] Commit the chat and learning migration.

### Task 4: Migrate canvas and library surfaces

**Files:** `components/canvas/*`, `components/library/*`, and tests.

- [ ] Write failing tests for canvas controls, focus drawer, command palette, file filters, viewers, upload, empty, and error states.
- [ ] Replace legacy controls and overlays with shared primitives while retaining React Flow and file behavior.
- [ ] Run canvas and library tests, typecheck, and browser walkthroughs.
- [ ] Commit the canvas and library migration.

### Task 5: Enforce and verify the migration

**Files:** UI contract tests and every changed app surface.

- [ ] Add an inventory test that rejects direct legacy primitive imports and raw interactive elements in app surfaces.
- [ ] Run the full web test suite, typecheck, production build, and dark-mode/browser visual verification.
- [ ] Resolve all migration-caused failures and document any unrelated pre-existing failure with reproduction evidence.
- [ ] Commit the verification gate.
