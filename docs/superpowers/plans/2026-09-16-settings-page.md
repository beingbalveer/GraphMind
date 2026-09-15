# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal settings editor with a reusable-primitive-based settings page at `/w/{workspaceId}/settings` while retaining GraphMind's workspace shell and configuration behavior.

**Architecture:** `ChatContainer` remains mounted for the workspace settings route and renders a new `SettingsPage` in its central content area. Shared UI primitives live in `components/ui`; the page receives the current workspace and model-config callbacks from `ChatContainer`, preserving local-storage persistence and live chat configuration.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Base UI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-15-settings-page-design.md`

## Global Constraints

- Preserve current workspace route navigation, chat sidebar, and workspace state.
- Use `router.push()` plus central URL helpers; never construct workspace URLs in a component.
- Shared UI components remain under `apps/web/src/components/ui/` and use no product-specific visual variants.
- Do not use the name `assistant-ui` in GraphMind source code.
- Preserve provider/model behavior, API-key handling, Ollama validation, disabled roadmap controls, save/reset behavior, and accessibility.
- Keep reset and unsaved-exit confirmation as dialogs; the Settings experience itself is a page.

---

### Task 1: Add canonical Settings route support

**Files:**
- Modify: `apps/web/src/lib/urls.ts`
- Modify: `apps/web/src/components/layout/Navbar.tsx`
- Modify: `apps/web/src/app/w/[workspaceId]/layout.tsx`
- Create: `apps/web/src/app/w/[workspaceId]/settings/page.tsx`
- Test: `apps/web/src/components/layout/__tests__/routing-and-state.test.tsx`

**Interfaces:**
- Produces: `buildSettingsUrl(workspaceId: string): string`.
- Produces: `ViewMode` member `"settings"`.
- Consumes: workspace layout pathname parsing and `ChatContainer`'s `initialViewMode` prop.

- [ ] **Step 1: Write the failing route contract test**

```tsx
it("builds the canonical workspace settings URL", () => {
  expect(buildSettingsUrl("workspace-1")).toBe("/w/workspace-1/settings");
});
```

- [ ] **Step 2: Run the route contract test and verify it fails**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/layout/__tests__/routing-and-state.test.tsx`

Expected: FAIL because `buildSettingsUrl` does not exist.

- [ ] **Step 3: Implement the route contract**

```ts
export const buildSettingsUrl = (workspaceId: string): string =>
  `/w/${workspaceId}/settings`;
```

Extend `ViewMode`, make the workspace layout recognize `/settings`, and add the App Router page file so the canonical path resolves while preserving the parent layout.

- [ ] **Step 4: Run the focused route test and typecheck**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/layout/__tests__/routing-and-state.test.tsx && pnpm --filter @graphmind/web typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the route support**

```bash
git add apps/web/src/lib/urls.ts apps/web/src/components/layout/Navbar.tsx apps/web/src/app/w/[workspaceId]/layout.tsx apps/web/src/app/w/[workspaceId]/settings/page.tsx apps/web/src/components/layout/__tests__/routing-and-state.test.tsx
git commit -m "feat(web): add settings route"
```

### Task 2: Add reusable settings primitives

**Files:**
- Create: `apps/web/src/components/ui/dialog.tsx`, `tabs.tsx`, `select.tsx`, `kbd.tsx`, and `separator.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`, `textarea.tsx`, `switch.tsx`, `badge.tsx`, `dropdown-menu.tsx`, and `apps/web/src/app/globals.css`
- Test: `apps/web/src/components/ui/__tests__/settings-primitives.test.tsx`

**Interfaces:**
- Produces composable `Dialog`, `Tabs`, `Select`, `Kbd`, and `Separator` exports under `@/components/ui/`.
- Produces controlled `value`/ `onValueChange` APIs for Tabs and Select.
- Consumes: `@base-ui/react`, `class-variance-authority`, and `cn`.

- [ ] **Step 1: Write failing primitive behavior tests**

```tsx
it("changes a controlled tab through keyboard-accessible tab triggers", async () => {
  const user = userEvent.setup();
  render(<TestTabs />);
  await user.click(screen.getByRole("tab", { name: "General" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("General settings");
});

it("changes a controlled select value", async () => {
  const user = userEvent.setup();
  render(<TestSelect />);
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Gemini" }));
  expect(screen.getByRole("combobox")).toHaveTextContent("Gemini");
});
```

- [ ] **Step 2: Run the primitive test and verify it fails**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/ui/__tests__/settings-primitives.test.tsx`

Expected: FAIL because the shared Tabs and Select exports do not exist.

- [ ] **Step 3: Add minimal reusable primitives**

Copy the official Base UI registry source into the designated shared files. Preserve upstream variants and accessibility attributes. Define only required semantic tokens (`secondary`, `secondary-foreground`, `ring`, and radius tokens) in `globals.css`; do not add product-specific style variants.

- [ ] **Step 4: Run focused UI tests and typecheck**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/ui/__tests__/settings-primitives.test.tsx src/components/ui/__tests__/button.test.tsx && pnpm --filter @graphmind/web typecheck`

Expected: PASS with keyboard-accessible controls.

- [ ] **Step 5: Commit shared primitives**

```bash
git add apps/web/src/components/ui apps/web/src/app/globals.css
git commit -m "feat(web): add shared settings primitives"
```

### Task 3: Extract SettingsPage and preserve configuration behavior

**Files:**
- Create: `apps/web/src/components/settings/SettingsPage.tsx`
- Modify: `apps/web/src/components/settings/SettingsModal.tsx`
- Modify: `apps/web/src/components/settings/__tests__/settings-surfaces.test.tsx`
- Create: `apps/web/src/components/settings/__tests__/settings-page.test.tsx`

**Interfaces:**
- Produces `SettingsPageProps` with `config`, `onSaveConfig`, `onResetDefaults`, `currentWorkspace`, `onNavigateBack`, and `initialTab`.
- Consumes: `LLMConfig`, `WorkspaceItem`, and Task 2 primitives.
- Preserves: provider/model selection, key masking, Ollama URL validation, reset confirmation, and disabled roadmap controls.

- [ ] **Step 1: Write failing settings-page behavior tests**

```tsx
it("saves a selected provider and model through the shared configuration callback", async () => {
  const user = userEvent.setup();
  const onSaveConfig = vi.fn();
  render(<SettingsPage {...props} onSaveConfig={onSaveConfig} />);
  await user.click(screen.getByRole("tab", { name: "Models" }));
  await selectOption(user, "Provider", "Ollama");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onSaveConfig).toHaveBeenCalledWith(expect.objectContaining({ provider: "ollama" }));
});

it("keeps the form open and announces an invalid Ollama URL", async () => {
  const user = userEvent.setup();
  render(<SettingsPage {...props} />);
  await selectOption(user, "Provider", "Ollama");
  await user.clear(screen.getByLabelText("Ollama Server URL"));
  await user.type(screen.getByLabelText("Ollama Server URL"), "invalid-url");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Invalid Ollama Server URL");
});
```

- [ ] **Step 2: Run the page test and verify it fails**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/settings/__tests__/settings-page.test.tsx`

Expected: FAIL because `SettingsPage` does not exist.

- [ ] **Step 3: Implement SettingsPage**

Move the settings state and sections from `SettingsModal` into `SettingsPage`. Replace the custom modal sidebar, provider cards, segmented tabs, and settings-row surfaces with Task 2 primitives. Keep all six current sections and form semantics. Render reset and unsaved-exit confirmation with `Dialog`.

- [ ] **Step 4: Run focused settings tests and typecheck**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/settings/__tests__/settings-page.test.tsx src/components/settings/__tests__/settings-surfaces.test.tsx && pnpm --filter @graphmind/web typecheck`

Expected: PASS with no API or persistence regressions.

- [ ] **Step 5: Commit SettingsPage**

```bash
git add apps/web/src/components/settings
git commit -m "feat(web): replace settings modal with page"
```

### Task 4: Integrate SettingsPage into the workspace shell

**Files:**
- Modify: `apps/web/src/components/chat/ChatContainer.tsx`, `ChatSidebar.tsx`, and `apps/web/src/hooks/useKeyboardShortcuts.ts`
- Test: `apps/web/src/components/chat/__tests__/chat-sidebar.test.tsx`, `apps/web/src/components/layout/__tests__/workspace-shell.test.tsx`, and `routing-and-state.test.tsx`

**Interfaces:**
- Consumes: `buildSettingsUrl`, `SettingsPage`, `ViewMode === "settings"`, existing `llmConfig` callbacks, and `currentWorkspace`.
- Produces: canonical settings navigation with the workspace shell and persistent chat sidebar.

- [ ] **Step 1: Write failing integration tests**

```tsx
it("navigates to the canonical settings page from the sidebar", async () => {
  const user = userEvent.setup();
  render(<ChatSidebar {...props} onOpenSettings={onOpenSettings} />);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

it("renders settings in the workspace shell without removing navigation", () => {
  render(<WorkspaceShell navigation={<nav aria-label="Chats" />} header={<header />}><SettingsPage {...props} /></WorkspaceShell>);
  expect(screen.getByRole("navigation", { name: "Chats" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run integration tests and verify they fail**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/chat/__tests__/chat-sidebar.test.tsx src/components/layout/__tests__/workspace-shell.test.tsx`

Expected: FAIL because Settings still opens a modal.

- [ ] **Step 3: Integrate the settings page**

Replace the local modal state with `router.push(buildSettingsUrl(currentWorkspace.id))`. Render `SettingsPage` when `viewMode` is `"settings"`; retain the workspace shell and sidebar. Route the keyboard shortcut through the same handler. Remove the modal mount after all consumers use the page.

- [ ] **Step 4: Run focused integration tests and typecheck**

Run: `pnpm --filter @graphmind/web exec vitest run src/components/chat/__tests__/chat-sidebar.test.tsx src/components/layout/__tests__/workspace-shell.test.tsx src/components/layout/__tests__/routing-and-state.test.tsx && pnpm --filter @graphmind/web typecheck`

Expected: PASS with canonical navigation and retained shell navigation.

- [ ] **Step 5: Commit integration**

```bash
git add apps/web/src/components/chat/ChatContainer.tsx apps/web/src/components/chat/ChatSidebar.tsx apps/web/src/hooks/useKeyboardShortcuts.ts apps/web/src/components/chat/__tests__/chat-sidebar.test.tsx apps/web/src/components/layout/__tests__/workspace-shell.test.tsx
git commit -m "feat(web): show settings in workspace shell"
```

### Task 5: Verify production behavior

- [ ] **Step 1: Run all frontend tests**

Run: `pnpm --filter @graphmind/web test`

Expected: PASS. If an unrelated existing failure remains, reproduce it in isolation and report its cause without modifying unrelated behavior.

- [ ] **Step 2: Run static and production verification**

Run: `pnpm --filter @graphmind/web typecheck && pnpm --filter @graphmind/web build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 3: Inspect final scope and commit repairs if required**

```bash
git status --short
git diff --check
git commit -am "fix(web): complete settings page migration"
```

