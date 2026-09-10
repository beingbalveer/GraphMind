# Canonical Chat Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose GraphMind’s existing chat surface into the approved GraphMind Calm learning experience while preserving streaming, branching, attachments, tools, sources, skills, retry, stop, and URL behavior.

**Architecture:** Keep `useChatStream` and existing route contracts as the behavioral boundary. Move presentation into small, testable message, composer, activity, and learning-state compositions that consume the shared UI primitives from Task 1. The chat column is fluid below `--chat-content-max` and uses a quiet user surface, borderless assistant content, stable composer, and contextual learning signals.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, Radix primitives, Vitest, Testing Library, existing `react-markdown`/KaTeX/highlight pipeline.

**Spec:** `docs/superpowers/specs/2026-09-09-graphmind-ui-system-design.md`

## Global Constraints

- Use `@/components/ui/` primitives for every interactive control; never add raw `<button>`, modal, drawer, menu, or hand-rolled input controls.
- Use semantic tokens (`bg-surface`, `bg-muted`, `text-foreground`, `border-border`, status roles); no palette literals in migrated chat TSX.
- Preserve the canonical URL hierarchy and use helpers from `@/lib/urls`; do not introduce query-param primary navigation.
- Preserve `useChatStream` behavior, attachment upload/file-library behavior, skills/slash commands, branch lineage, selection exploration, retry, regenerate, edit, stop, and send flows.
- Support light/dark token themes, visible keyboard focus, screen-reader labels, reduced motion, and minimum practical touch targets.
- Keep the desktop conversation content at `--chat-content-max: 44rem`; remain fluid below that width.
- Do not implement the adaptive shell, mobile navigation, canvas, persistence, or new provider APIs in this plan.

## File Responsibility Map

- `apps/web/src/components/chat/ChatMessage.tsx`: message hierarchy, Markdown presentation, attachments, actions, branches, sources, and inline learning cues.
- `apps/web/src/components/chat/ChatInput.tsx`: composer layout, multiline input, attachment/skill controls, send/stop state, and slash-command interactions.
- `apps/web/src/components/chat/AgentToolCallsBanner.tsx`: collapsed activity group and tool failure/retry presentation.
- `apps/web/src/components/chat/BranchBreadcrumbs.tsx`: compact lineage navigation using shared controls.
- `apps/web/src/components/chat/SelectionTooltip.tsx`: keyboard-accessible text-selection exploration actions.
- `apps/web/src/components/chat/ChatContainer.tsx`: canonical chat column composition and message/stream state wiring.
- `apps/web/src/components/chat/RightSidebar.tsx`: contextual learning rail entry points without duplicating mastery content in every answer.
- `apps/web/src/components/chat/__tests__/`: focused regression tests for each presentation boundary; no network calls.

### Task 1: Normalize Markdown and message surfaces

**Files:**
- Modify: `apps/web/src/components/chat/ChatMessage.tsx`
- Create: `apps/web/src/components/chat/__tests__/chat-message.test.tsx`

**Interfaces:**
- Consumes: `TreeNode`, `ConversationTree`, `FileAttachment`, `MarkdownRenderer`, `CopyButton`, `Button`, `Surface`, `Modal`, and existing callback props.
- Produces: the existing `ChatMessageProps`, `injectBranchLinks`, and `MarkdownRenderer` exports with unchanged callback signatures.

- [ ] **Step 1: Write failing presentation and keyboard tests**

```tsx
it("renders a user prompt in a quiet surface and an assistant answer without a border", () => {
  render(<ChatMessage message={userNode} />);
  expect(screen.getByText(userNode.content)).toHaveClass("bg-muted", "rounded-2xl");
  render(<ChatMessage message={assistantNode} />);
  expect(screen.getByText(assistantNode.content)).not.toHaveClass("border");
});

it("keeps message actions available by keyboard", async () => {
  const user = userEvent.setup();
  render(<ChatMessage message={userNode} isLastUserMessage onEditUserMessage={vi.fn()} />);
  await user.tab();
  expect(screen.getByRole("button", { name: "Edit message" })).toHaveFocus();
});
```

- [ ] **Step 2: Run the focused test and capture the existing failure**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-message.test.tsx
```

Expected: FAIL because current message actions use raw buttons, user edit uses hardcoded palette styling, and Markdown/attachment surfaces are not semantic.

- [ ] **Step 3: Recompose message hierarchy and Markdown tokens**

Use `Surface` for the user prompt and attachment groups, `Button`/`IconButton`/`CopyButton` for actions, and semantic classes for Markdown, blockquotes, inline code, attachment cards, and fullscreen controls. Preserve all existing viewer callbacks and branch-link injection. Actions must use `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` so keyboard focus reveals them. Keep assistant content borderless and apply `--chat-content-max` to the message column.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-message.test.tsx
pnpm --filter @graphmind/web typecheck
git diff --check
git add apps/web/src/components/chat/ChatMessage.tsx apps/web/src/components/chat/__tests__/chat-message.test.tsx
git commit -m "refactor(web): establish canonical message hierarchy"
```

### Task 2: Rebuild the composer around shared controls

**Files:**
- Modify: `apps/web/src/components/chat/ChatInput.tsx`
- Create: `apps/web/src/components/chat/__tests__/chat-input.test.tsx`

**Interfaces:**
- Consumes: `ChatInputProps`, `Textarea`, `Button`, `IconButton`, `DropdownMenu`/`MenuCard`, `FileLibraryModal`, and existing upload helpers.
- Produces: unchanged `ChatInputProps` and callback behavior.

- [ ] **Step 1: Write failing composer behavior tests**

```tsx
it("submits with Enter and preserves Shift+Enter", async () => {
  const user = userEvent.setup();
  const onSendMessage = vi.fn();
  render(<ChatInput {...baseProps} onSendMessage={onSendMessage} />);
  const input = screen.getByRole("textbox");
  await user.type(input, "Explain branching");
  await user.keyboard("{Enter}");
  expect(onSendMessage).toHaveBeenCalledWith("Explain branching", [], null);
});

it("keeps a stable send/stop control and exposes attachment mode", () => {
  render(<ChatInput {...baseProps} />);
  expect(screen.getByRole("button", { name: "Add attachment or select mode" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
});
```

- [ ] **Step 2: Run the test and capture the existing failure**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-input.test.tsx
```

Expected: FAIL because the composer uses raw `<textarea>` and raw buttons, and the current action menu is not represented by the shared primitive contract.

- [ ] **Step 3: Implement the stable composer**

Use one `Surface variant="raised" radius="card"` composer with `Textarea maxRowsClassName="max-h-48"`, `IconButton` for attachment/clear controls, `DropdownMenu` or the existing `MenuCard` compatibility API for upload/skill choices, and `Button` for send/stop. Keep attachments inside the composer above the text field, preserve drag/drop/paste/file-library flows, keep send/stop in one stable right slot, and add `motion-reduce:animate-none` to nonessential transitions.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-input.test.tsx
pnpm --filter @graphmind/web typecheck
git diff --check
git add apps/web/src/components/chat/ChatInput.tsx apps/web/src/components/chat/__tests__/chat-input.test.tsx
git commit -m "refactor(web): standardize canonical chat composer"
```

### Task 3: Normalize activity, branch, source, and selection signals

**Files:**
- Modify: `apps/web/src/components/chat/AgentToolCallsBanner.tsx`
- Modify: `apps/web/src/components/chat/BranchBreadcrumbs.tsx`
- Modify: `apps/web/src/components/chat/SelectionTooltip.tsx`
- Modify: relevant activity/source/branch sections in `apps/web/src/components/chat/ChatMessage.tsx`
- Create: `apps/web/src/components/chat/__tests__/chat-learning-signals.test.tsx`

**Interfaces:**
- Consumes: existing tool-call, branch, RAG-source, and selection callback props; `Collapsible`, `InlineFeedback`, `Badge`, `IconButton`, `Button`.
- Produces: unchanged public props and callback signatures for all four components.

- [ ] **Step 1: Write failing learning-signal tests**

```tsx
it("starts activity and sources collapsed", () => {
  render(<AgentToolCallsBanner toolCalls={[toolCall]} />);
  expect(screen.getByRole("button", { name: /activity/i })).toHaveAttribute("aria-expanded", "false");
});

it("exposes branch lineage without making it a permanent message badge", () => {
  render(<BranchBreadcrumbs {...branchProps} />);
  expect(screen.getByRole("navigation", { name: "Branch lineage" })).toBeVisible();
});

it("offers a real selection exploration action", async () => {
  const user = userEvent.setup();
  render(<SelectionTooltip {...selectionProps} />);
  await user.click(screen.getByRole("button", { name: "Explore branch" }));
  expect(selectionProps.onExplore).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run focused tests and capture the existing failures**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-learning-signals.test.tsx
```

- [ ] **Step 3: Implement contextual signal patterns**

Use `Collapsible` for tool activity and source groups, `InlineFeedback tone="destructive"` for tool/stream failures with real recovery actions, compact `Badge` only for meaningful status, and semantic `Button`/`IconButton` actions. Branch lineage remains a compact navigational cue. Selection actions remain keyboard reachable and do not depend on hover alone. Preserve RAG viewer opening, branch switching, and existing callbacks.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-learning-signals.test.tsx
pnpm --filter @graphmind/web typecheck
git diff --check
git add apps/web/src/components/chat/AgentToolCallsBanner.tsx apps/web/src/components/chat/BranchBreadcrumbs.tsx apps/web/src/components/chat/SelectionTooltip.tsx apps/web/src/components/chat/ChatMessage.tsx apps/web/src/components/chat/__tests__/chat-learning-signals.test.tsx
git commit -m "refactor(web): clarify chat learning signals"
```

### Task 4: Compose the canonical chat column and contextual rail

**Files:**
- Modify: `apps/web/src/components/chat/ChatContainer.tsx`
- Modify: `apps/web/src/components/chat/RightSidebar.tsx`
- Create: `apps/web/src/components/chat/__tests__/chat-container.test.tsx`

**Interfaces:**
- Consumes: unchanged `ChatContainerProps`, `ChatMessage`, `ChatInput`, `MasteryPanel`, `RightSidebar`, URL helpers, and view-mode routing.
- Produces: unchanged route-facing props and `ChatContainer` behavior.

- [ ] **Step 1: Write failing composition tests**

```tsx
it("constrains the conversation column and keeps the composer at the bottom", () => {
  render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);
  expect(screen.getByTestId("chat-content-column")).toHaveClass("max-w-[var(--chat-content-max)]");
  expect(screen.getByTestId("chat-composer-shell")).toBeVisible();
});

it("keeps contextual mastery outside the answer body", () => {
  render(<ChatContainer initialWorkspaceId="ws_test" initialViewMode="chat" />);
  expect(screen.getByRole("button", { name: "Open right panel" })).toBeVisible();
  expect(screen.queryByText("Mastery", { selector: "article *" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and capture the existing failure**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-container.test.tsx
```

- [ ] **Step 3: Compose the canonical layout**

Add explicit `data-testid` hooks only for stable test boundaries. Use a fluid column capped by `var(--chat-content-max)`, maintain scroll anchoring during streaming, render empty/loading/error states with `Skeleton`/`InlineFeedback`, and keep mastery/gaps/next-topic information in `RightSidebar` or its existing open-panel path. Preserve chat/canvas view routing, deep-link node/branch behavior, and right-panel persistence.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/chat/__tests__/chat-container.test.tsx
pnpm --filter @graphmind/web typecheck
git diff --check
git add apps/web/src/components/chat/ChatContainer.tsx apps/web/src/components/chat/RightSidebar.tsx apps/web/src/components/chat/__tests__/chat-container.test.tsx
git commit -m "refactor(web): compose canonical chat experience"
```

### Task 5: Contract verification and visual migration gate

**Files:**
- Create: `apps/web/src/components/chat/__tests__/chat-design-contract.test.ts`
- Modify: `apps/web/src/components/chat/README.md`

- [ ] **Step 1: Add the chat-specific source contract**

Scan only migrated chat TSX files and reject raw buttons, hardcoded palette classes, arbitrary typography, hover-only visibility, and duplicate modal/menu implementations. Permit viewer-specific code syntax classes only where they are isolated inside the existing code viewer boundary.

- [ ] **Step 2: Run complete verification**

```bash
pnpm --filter @graphmind/web test -- --maxWorkers=2
pnpm --filter @graphmind/web typecheck
pnpm --filter @graphmind/web lint
pnpm --filter @graphmind/web build
```

- [ ] **Step 3: Perform the visual matrix**

Verify light and dark tokens where the current app exposes them, and verify at 1440px, 768px, and 390px that the chat column, composer, message actions, attachments, branch cues, source/activity groups, and right-panel entry point remain legible and keyboard reachable. Record the existing adaptive-shell limitation separately; do not implement it in this task.

- [ ] **Step 4: Commit the contract and documentation**

```bash
git add apps/web/src/components/chat/__tests__/chat-design-contract.test.ts apps/web/src/components/chat/README.md
git diff --cached --check
git commit -m "test(web): enforce canonical chat design contract"
```

## Definition of Done

- All five tasks are independently reviewed and committed.
- Existing streaming, branch, attachment, file-library, skill, retry, regenerate, edit, stop, send, viewer, and URL flows still work.
- Chat messages and composer use shared primitives and semantic tokens, with keyboard/focus/reduced-motion behavior covered by tests.
- The content column uses `--chat-content-max`, user prompts are distinct but quiet, assistant content is borderless, and learning signals are contextual rather than repeated in every answer.
- Full frontend tests, typecheck, lint, and production build pass.
- The adaptive-shell/mobile-sidebar limitation is documented for Task 3 and is not silently widened into this plan.
