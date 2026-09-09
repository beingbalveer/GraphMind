# UI Foundations and Generic Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the GraphMind Calm token contract and a tested, accessible set of GraphMind-owned generic UI primitives without changing chat, canvas, routing, persistence, or provider behavior.

**Architecture:** Semantic values live in `globals.css`; generic controls in `components/ui` consume only those values. Radix primitives supply focus management and keyboard semantics for overlays and compound controls, while GraphMind retains its existing public component APIs where product consumers already depend on them.

**Tech Stack:** Next.js 15, React 19, TypeScript strict mode, Tailwind CSS 4, class-variance-authority, Radix UI primitives, Vitest 4, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-09-graphmind-ui-system-design.md`

## Global Constraints

- Do not add `assistant-ui` or copy its runtime or component source.
- Preserve `useChatStream`, `useScrollAnchor`, workspace API, shared domain types, and the canonical URL hierarchy.
- Use primitives from `@/components/ui/`; product components must not gain new raw buttons, inputs, menus, modals, or drawers.
- Use semantic theme utilities; hardcoded palette colors belong only in the theme variable definitions in `globals.css`.
- Support light and dark themes, keyboard navigation, visible focus, screen-reader labels, minimum practical touch targets, and `prefers-reduced-motion`.
- Use only the standard typography sizes `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, and `text-xl`.
- Use the repository spacing scale; do not add classes such as `h-8.5`, `px-4.5`, or arbitrary text sizes.
- Header primitives remain `h-13`; icon buttons use `size="iconSm"` or `size="icon"`; interactive controls use `rounded-lg`, inner widgets `rounded-xl`, and cards/modals `rounded-2xl`.
- Complete only this foundations-and-primitives plan. Chat, adaptive shell, canvas, dashboard, library, and settings migrations are later approved tasks.
- Preserve the user's existing uncommitted edits in `apps/web/src/components/ui/button.tsx` and `apps/web/src/components/workspace/WorkspaceDashboard.tsx`. Retain the `loading` behavior already introduced in `Button`; do not stage or commit `WorkspaceDashboard.tsx` without explicit user authorization.
- Before editing `button.tsx`, resolve ownership of its existing unstaged diff with the user. If the user does not authorize including that diff, stop before Task 1 rather than staging it accidentally.

---

## File Responsibility Map

### Test infrastructure

- `apps/web/vitest.config.ts`: browser-component test environment and `@` alias.
- `apps/web/src/test/setup.ts`: Testing Library matchers and DOM cleanup.
- `apps/web/src/components/ui/__tests__/*.test.tsx`: interaction and accessibility contracts.
- `apps/web/src/components/ui/__tests__/design-contract.test.ts`: static enforcement of semantic styling inside `components/ui`.

### Foundations and primitives

- `apps/web/src/app/globals.css`: GraphMind Calm semantic tokens, motion, focus, overlay, and `--chat-content-max`.
- `apps/web/src/components/ui/button.tsx`: button variants, sizes, shape, and loading state.
- `apps/web/src/components/ui/tooltip.tsx`: Radix tooltip exports with GraphMind styling.
- `apps/web/src/components/ui/icon-button.tsx`: labeled icon-only button composed from `Button` and `Tooltip`.
- `apps/web/src/components/ui/surface.tsx`: standard base, raised, muted, and interactive surfaces.
- `apps/web/src/components/ui/skeleton.tsx`: accessible reduced-motion loading placeholder.
- `apps/web/src/components/ui/input.tsx`: labeled/error-capable single-line field.
- `apps/web/src/components/ui/textarea.tsx`: multiline field matching `Input` states.
- `apps/web/src/components/ui/menu.tsx`: presentational menu card, header, and item composed from shared primitives.
- `apps/web/src/components/ui/dropdown-menu.tsx`: accessible Radix-powered compatibility wrapper.
- `apps/web/src/components/ui/collapsible.tsx`: styled Radix collapsible exports.
- `apps/web/src/components/ui/modal.tsx`: focus-trapped accessible dialog with the existing API.
- `apps/web/src/components/ui/drawer.tsx`: accessible side dialog with the existing API.
- `apps/web/src/components/ui/confirm-dialog.tsx`: confirmation semantics composed from `Modal` and `Button`.
- `apps/web/src/components/ui/switch.tsx`: Radix switch preserving the current controlled API.
- `apps/web/src/components/ui/segmented-tabs.tsx`: Radix tabs preserving the generic item API.
- `apps/web/src/components/ui/badge.tsx`: semantic badge variants.
- `apps/web/src/components/ui/copy-button.tsx`: clipboard action composed from `IconButton`.
- `apps/web/src/components/ui/toast.tsx`: semantic, announced error feedback.
- `apps/web/src/components/ui/feedback.tsx`: reusable inline, empty, and error feedback layouts.
- `apps/web/src/components/ui/setting-row.tsx`: semantic setting layout using `Badge` and `Surface`.
- `apps/web/src/components/ui/Logo.tsx`: GraphMind mark using semantic brand/surface roles.
- `apps/web/src/components/ui/README.md`: component-selection and variant guidance.

---

### Task 1: Add the component test harness and normalize Button, Tooltip, and IconButton

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/tooltip.tsx`
- Create: `apps/web/src/components/ui/icon-button.tsx`
- Create: `apps/web/src/components/ui/__tests__/button.test.tsx`
- Create: `apps/web/src/components/ui/__tests__/icon-button.test.tsx`

**Interfaces:**
- Consumes: `cn(...inputs: ClassValue[]): string` from `@/lib/utils`; existing `ButtonProps.loading` behavior from the user's worktree.
- Produces: `Button`, `buttonVariants`, `ButtonProps`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`, `IconButton`, and `IconButtonProps`.
- `IconButtonProps` is `Omit<ButtonProps, "children" | "aria-label"> & { label: string; tooltip?: React.ReactNode; children: React.ReactElement }`.

- [ ] **Step 1: Install the exact runtime and test categories required by this plan**

Run:

```bash
pnpm --filter @graphmind/web add @radix-ui/react-collapsible @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-tooltip
pnpm --filter @graphmind/web add -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Expected: `apps/web/package.json` and `pnpm-lock.yaml` record the resolved versions; `assistant-ui` is absent.

- [ ] **Step 2: Add test scripts and the jsdom configuration**

Add to `apps/web/package.json`:

```json
"scripts": {
  "dev": "next dev -p 3300",
  "build": "next build",
  "start": "next start -p 3300",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Create `apps/web/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 3: Write failing Button and IconButton tests**

Create `button.test.tsx` with these assertions:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  it("disables itself and exposes a loading label while loading", () => {
    render(<Button loading loadingLabel="Creating workspace">Create</Button>);
    const button = screen.getByRole("button", { name: "Creating workspace" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps standard dimensions and supports an explicit pill shape", () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8", "rounded-lg");
    rerender(<Button shape="pill">Save</Button>);
    expect(screen.getByRole("button")).toHaveClass("rounded-full");
  });
});
```

Create `icon-button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "../icon-button";

describe("IconButton", () => {
  it("always exposes an accessible label", () => {
    render(<IconButton label="Add attachment"><Plus /></IconButton>);
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeVisible();
  });

  it("shows the optional tooltip on focus", async () => {
    render(<IconButton label="Add attachment" tooltip="Attach a file"><Plus /></IconButton>);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Attach a file");
  });
});
```

- [ ] **Step 4: Run the focused tests and verify they fail**

Run:

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/button.test.tsx src/components/ui/__tests__/icon-button.test.tsx
```

Expected: FAIL because `loadingLabel`, `Tooltip`, and `IconButton` do not yet exist and Button still uses non-standard dimensions/default shape.

- [ ] **Step 5: Implement the minimum accessible contracts**

In `button.tsx`, retain the existing loading spinner behavior and normalize the public variants:

```ts
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  loadingLabel?: string;
}
```

Use only `h-7`, `h-8`, `h-9`, `size-7`, and `size-8`. Default to `shape="rectangle"`; expose `pill` and `round` explicitly. When loading, set `disabled`, `aria-busy="true"`, and `aria-label={loadingLabel}` while keeping the visible children stable.

Implement `tooltip.tsx` with Radix exports. `TooltipContent` must use `bg-foreground text-background`, `rounded-lg`, `text-xs`, `z-dropdown`, and reduced-motion-safe transitions.

Implement `icon-button.tsx` as composition, not a second button variant system:

```tsx
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip, children, ...props }, ref) => {
    const control = (
      <Button ref={ref} type="button" size="iconSm" shape="round" aria-label={label} {...props}>
        {children}
      </Button>
    );
    if (!tooltip) return control;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{control}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
```

- [ ] **Step 6: Run the focused tests and typecheck**

Run:

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/button.test.tsx src/components/ui/__tests__/icon-button.test.tsx
pnpm --filter @graphmind/web typecheck
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit only Task 1 files**

Do not stage `WorkspaceDashboard.tsx`. Inspect `git diff --cached` before committing.

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/vitest.config.ts apps/web/src/test/setup.ts apps/web/src/components/ui/button.tsx apps/web/src/components/ui/tooltip.tsx apps/web/src/components/ui/icon-button.tsx apps/web/src/components/ui/__tests__/button.test.tsx apps/web/src/components/ui/__tests__/icon-button.test.tsx
git diff --cached --check
git commit -m "feat(web): establish accessible button primitives"
```

### Task 2: Define the semantic token contract and standard surfaces

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/ui/surface.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/__tests__/design-tokens.test.ts`
- Create: `apps/web/src/components/ui/__tests__/surface.test.tsx`

**Interfaces:**
- Consumes: Tailwind 4 `@theme`; `cn`.
- Produces: semantic utilities for `surface-raised`, `foreground-subtle`, `border-strong`, `focus-ring`, `overlay`, and `--chat-content-max`; `Surface`; `SurfaceProps`; `Skeleton`; `SkeletonProps`.
- `SurfaceProps` extends `React.HTMLAttributes<HTMLDivElement>` and adds `variant?: "base" | "raised" | "muted" | "interactive"` and `radius?: "control" | "widget" | "card"`.
- `SkeletonProps` extends `React.HTMLAttributes<HTMLDivElement>` and adds `label: string`.

- [ ] **Step 1: Write the failing token and surface tests**

Create `design-tokens.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("GraphMind Calm token contract", () => {
  it.each([
    "--surface-raised:",
    "--foreground-subtle:",
    "--border-strong:",
    "--focus-ring:",
    "--overlay:",
    "--chat-content-max: 44rem",
  ])("defines %s in the theme", (token) => expect(css).toContain(token));

  it("defines every semantic role for dark mode", () => {
    const darkBlock = css.slice(css.indexOf(".dark"));
    for (const token of ["--surface-raised:", "--foreground-subtle:", "--border-strong:", "--focus-ring:", "--overlay:"]) {
      expect(darkBlock).toContain(token);
    }
  });
});
```

Create `surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "../surface";
import { Skeleton } from "../skeleton";

describe("surface primitives", () => {
  it("maps raised cards to semantic elevation", () => {
    render(<Surface variant="raised" radius="card">Content</Surface>);
    expect(screen.getByText("Content")).toHaveClass("bg-surface-raised", "rounded-2xl");
  });

  it("announces a labeled loading region", () => {
    render(<Skeleton label="Loading conversation" />);
    expect(screen.getByRole("status", { name: "Loading conversation" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/design-tokens.test.ts src/components/ui/__tests__/surface.test.tsx
```

Expected: FAIL because the new tokens and components are absent.

- [ ] **Step 3: Extend the light and dark semantic themes**

Add these Tailwind mappings under `@theme`:

```css
--color-surface-raised: var(--surface-raised);
--color-foreground-subtle: var(--foreground-subtle);
--color-border-strong: var(--border-strong);
--color-focus-ring: var(--focus-ring);
--color-overlay: var(--overlay);
```

Add these exact light-theme values to `:root`:

```css
--surface-raised: #ffffff;
--foreground-subtle: #71717a;
--border-strong: #d4d4d8;
--primary: #4f46e5;
--primary-foreground: #ffffff;
--focus-ring: #6366f1;
--overlay: rgba(9, 9, 11, 0.44);
--chat-content-max: 44rem;
```

Add these exact dark-theme overrides to `.dark`:

```css
--surface-raised: #202024;
--foreground-subtle: #71717a;
--border-strong: #3f3f46;
--primary: #818cf8;
--primary-foreground: #0b0b0f;
--focus-ring: #818cf8;
--overlay: rgba(0, 0, 0, 0.64);
```

Keep all literal palette values inside `globals.css`. Add a global reduced-motion rule that disables nonessential animation and shortens transitions without suppressing state changes:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Implement Surface and Skeleton**

Use CVA mappings only:

```ts
const surfaceVariants = cva("border", {
  variants: {
    variant: {
      base: "bg-surface border-border-subtle",
      raised: "bg-surface-raised border-border shadow-sm",
      muted: "bg-background-secondary border-border-subtle",
      interactive: "bg-surface border-border hover:bg-surface-hover focus-within:border-border-strong",
    },
    radius: {
      control: "rounded-lg",
      widget: "rounded-xl",
      card: "rounded-2xl",
    },
  },
  defaultVariants: { variant: "base", radius: "card" },
});
```

`Skeleton` renders `role="status"`, uses `bg-muted animate-pulse motion-reduce:animate-none`, and includes its label in an `sr-only` span.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/design-tokens.test.ts src/components/ui/__tests__/surface.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/app/globals.css apps/web/src/components/ui/surface.tsx apps/web/src/components/ui/skeleton.tsx apps/web/src/components/ui/__tests__/design-tokens.test.ts apps/web/src/components/ui/__tests__/surface.test.tsx
git diff --cached --check
git commit -m "feat(web): define GraphMind Calm foundations"
```

Expected: tests PASS, typecheck exits 0, and the commit contains no product-surface files.

### Task 3: Normalize Input and add Textarea

**Files:**
- Modify: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/__tests__/form-controls.test.tsx`

**Interfaces:**
- Consumes: semantic token utilities from Task 2.
- Produces: `Input`, `InputProps`, `Textarea`, `TextareaProps`.
- Both props add `invalid?: boolean` and `errorMessage?: string`; `Input` retains `startIcon`, `endIcon`, `variant`, and `inputSize`.

- [ ] **Step 1: Write failing field-state tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../input";
import { Textarea } from "../textarea";

describe("form controls", () => {
  it("connects an input error to the field", () => {
    render(<Input aria-label="Workspace name" invalid errorMessage="Name is required" />);
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
  });

  it("supports a constrained multiline input", () => {
    render(<Textarea aria-label="Message" maxRowsClassName="max-h-48" />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveClass("resize-none", "max-h-48");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/form-controls.test.tsx
```

Expected: FAIL because `Textarea`, `invalid`, and `errorMessage` do not exist.

- [ ] **Step 3: Implement the shared field contract**

Use `React.useId()` when an error message needs an ID and the caller did not provide `aria-describedby`. Apply `aria-invalid`, connect the error with `aria-describedby`, and render the error as `role="alert"` with `text-destructive text-xs`. Replace `text-zinc-400` icon wrappers with `text-foreground-subtle`. Use `focus-visible:ring-2 focus-visible:ring-focus-ring/30` and only standard heights: `h-7`, `h-8`, `h-10`.

Implement `Textarea` with the same default, ghost, invalid, disabled, and focus styling as `Input`:

```ts
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  errorMessage?: string;
  maxRowsClassName?: string;
}
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/form-controls.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/ui/input.tsx apps/web/src/components/ui/textarea.tsx apps/web/src/components/ui/__tests__/form-controls.test.tsx
git diff --cached --check
git commit -m "feat(web): standardize form control states"
```

### Task 4: Replace hand-rolled menus and add Collapsible

**Files:**
- Modify: `apps/web/src/components/ui/menu.tsx`
- Modify: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/collapsible.tsx`
- Create: `apps/web/src/components/ui/__tests__/dropdown-menu.test.tsx`
- Create: `apps/web/src/components/ui/__tests__/collapsible.test.tsx`

**Interfaces:**
- Consumes: `Button`, semantic tokens, Radix Dropdown Menu, Radix Collapsible.
- Produces: existing `DropdownMenu`, `DropdownMenuItemProps`, `MenuCard`, `MenuItem`, and `MenuHeader` APIs; `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` aliases.
- Existing `DropdownMenu` props stay compatible: `{ trigger: React.ReactNode; items: DropdownMenuItemProps[]; align?: "left" | "right"; className?: string; onOpenChange?: (isOpen: boolean) => void }`.

- [ ] **Step 1: Write keyboard and dismissal tests**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";
import { DropdownMenu } from "../dropdown-menu";

describe("DropdownMenu", () => {
  it("opens, supports arrow navigation, invokes an item, and restores focus", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<DropdownMenu trigger={<Button>Options</Button>} items={[{ label: "Rename", onClick: onRename }, { label: "Delete", variant: "destructive", onClick: vi.fn() }]} />);
    const trigger = screen.getByRole("button", { name: "Options" });
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onRename).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape without invoking an item", async () => {
    const user = userEvent.setup();
    render(<DropdownMenu trigger={<Button>Options</Button>} items={[{ label: "Rename", onClick: vi.fn() }]} />);
    await user.click(screen.getByRole("button", { name: "Options" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
```

Create `collapsible.test.tsx` with a controlled wrapper:

```tsx
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";

it("exposes and toggles its expanded state", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return <Collapsible open={open} onOpenChange={setOpen}><CollapsibleTrigger>Sources</CollapsibleTrigger><CollapsibleContent>Source list</CollapsibleContent></Collapsible>;
  }
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Sources" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Source list")).toBeVisible();
});
```

- [ ] **Step 2: Run tests and verify they fail against the hand-rolled implementation**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/dropdown-menu.test.tsx src/components/ui/__tests__/collapsible.test.tsx
```

Expected: FAIL because the existing menu has no `menu` semantics or arrow-key behavior and `collapsible.tsx` is absent.

- [ ] **Step 3: Implement the Radix-powered compatibility layer**

Use `DropdownMenuPrimitive.Root`, `Trigger`, `Portal`, `Content`, and `Item`. Preserve each item's React `onClick` callback by rendering the existing `MenuItem` through `Item asChild`. Replace the manual portal, fixed-coordinate calculation, global listeners, and `z-[9999]` with Radix positioning and `z-dropdown`.

Normalize `MenuCard`, `MenuItem`, and `MenuHeader` to semantic tokens. `MenuItem` must use standard `text-sm`, `rounded-lg`, and destructive tokens; remove all `zinc`, `rose`, and arbitrary `[18px]` values.

Create `collapsible.tsx`:

```tsx
"use client";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
const CollapsibleContent = CollapsiblePrimitive.Content;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
```

- [ ] **Step 4: Verify existing consumers still typecheck, then commit**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/dropdown-menu.test.tsx src/components/ui/__tests__/collapsible.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/ui/menu.tsx apps/web/src/components/ui/dropdown-menu.tsx apps/web/src/components/ui/collapsible.tsx apps/web/src/components/ui/__tests__/dropdown-menu.test.tsx apps/web/src/components/ui/__tests__/collapsible.test.tsx
git diff --cached --check
git commit -m "refactor(web): make menus and collapsibles accessible"
```

### Task 5: Rebuild Modal, Drawer, and ConfirmDialog on accessible dialog semantics

**Files:**
- Modify: `apps/web/src/components/ui/modal.tsx`
- Modify: `apps/web/src/components/ui/drawer.tsx`
- Modify: `apps/web/src/components/ui/confirm-dialog.tsx`
- Create: `apps/web/src/components/ui/__tests__/modal.test.tsx`
- Create: `apps/web/src/components/ui/__tests__/drawer.test.tsx`
- Create: `apps/web/src/components/ui/__tests__/confirm-dialog.test.tsx`

**Interfaces:**
- Consumes: Radix Dialog, `Button`, `IconButton`, semantic tokens.
- Produces: the existing `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`, `Drawer`, and `ConfirmDialog` public props without requiring product-consumer edits.
- `ModalHeader` renders a real Radix title and optional description. `ModalProps` also adds `ariaLabel?: string`, defaulting to `"Dialog"`, so existing consumers without `ModalHeader` remain named until their later surface migrations supply a descriptive label.

- [ ] **Step 1: Write failing focus, dismissal, and loading tests**

Test these concrete cases:

```tsx
it("names the dialog, focuses inside it, and restores trigger focus", async () => {
  const user = userEvent.setup();
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return <><Button onClick={() => setOpen(true)}>Open settings</Button><Modal isOpen={open} onClose={() => setOpen(false)}><ModalHeader title="Settings" onClose={() => setOpen(false)} /><ModalBody><Input aria-label="API key" /></ModalBody></Modal></>;
  }
  render(<Harness />);
  const trigger = screen.getByRole("button", { name: "Open settings" });
  await user.click(trigger);
  expect(screen.getByRole("dialog", { name: "Settings" })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "API key" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
```

Add these explicit cases to the overlay tests:

```tsx
it("honors closeOnClickOutside=false", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Modal isOpen onClose={onClose} closeOnClickOutside={false} ariaLabel="Protected dialog"><ModalBody>Protected</ModalBody></Modal>);
  await user.click(document.body);
  expect(onClose).not.toHaveBeenCalled();
});

it("gives a headerless dialog a compatibility name", () => {
  render(<Modal isOpen onClose={vi.fn()} ariaLabel="File library"><ModalBody>Files</ModalBody></Modal>);
  expect(screen.getByRole("dialog", { name: "File library" })).toBeVisible();
});

it("exposes the drawer as a named dialog and closes it with Escape", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<Drawer isOpen onClose={onClose} title="Branch details">Content</Drawer>);
  expect(screen.getByRole("dialog", { name: "Branch details" })).toBeVisible();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps a loading confirmation open and disables both actions", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<ConfirmDialog isOpen onClose={onClose} onConfirm={vi.fn()} title="Delete branch" description="This cannot be undone." isLoading />);
  expect(screen.getByRole("alertdialog", { name: "Delete branch" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Processing" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/modal.test.tsx src/components/ui/__tests__/drawer.test.tsx src/components/ui/__tests__/confirm-dialog.test.tsx
```

Expected: FAIL because current overlays lack complete dialog naming, focus trapping, and focus restoration.

- [ ] **Step 3: Implement overlays using Radix Dialog**

Map the controlled APIs to `<Dialog.Root open={isOpen} onOpenChange={...}>`. Use `Dialog.Portal`, `Dialog.Overlay`, and `Dialog.Content`. In `onPointerDownOutside` and `onEscapeKeyDown`, call `preventDefault()` when `closeOnClickOutside` is false or confirmation is loading.

Use `ModalHeader` to render `Dialog.Title` and `Dialog.Description`; use `IconButton` for close controls. Detect a direct shared header before assigning the compatibility label:

```tsx
const hasSharedHeader = React.Children.toArray(children).some(
  (child) => React.isValidElement(child) && child.type === ModalHeader
);

<DialogPrimitive.Content
  aria-label={hasSharedHeader ? undefined : ariaLabel ?? "Dialog"}
>
  {children}
</DialogPrimitive.Content>
```

Use `bg-overlay` rather than hardcoded black. Drawer uses the same semantics, defaults its accessible name to the string `title` or `"Panel"`, and changes only placement/transition classes. ConfirmDialog composes `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`, and `Button loading={isLoading}`; set `role="alertdialog"` and remove its second overlay implementation.

- [ ] **Step 4: Run all overlay tests and typecheck consumers**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/modal.test.tsx src/components/ui/__tests__/drawer.test.tsx src/components/ui/__tests__/confirm-dialog.test.tsx
pnpm --filter @graphmind/web typecheck
```

Expected: PASS. Existing modal and drawer callers compile without edits.

- [ ] **Step 5: Commit the overlay unit**

```bash
git add apps/web/src/components/ui/modal.tsx apps/web/src/components/ui/drawer.tsx apps/web/src/components/ui/confirm-dialog.tsx apps/web/src/components/ui/__tests__/modal.test.tsx apps/web/src/components/ui/__tests__/drawer.test.tsx apps/web/src/components/ui/__tests__/confirm-dialog.test.tsx
git diff --cached --check
git commit -m "refactor(web): unify accessible overlay primitives"
```

### Task 6: Normalize selection, status, feedback, settings, and brand primitives

**Files:**
- Modify: `apps/web/src/components/ui/switch.tsx`
- Modify: `apps/web/src/components/ui/segmented-tabs.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/copy-button.tsx`
- Modify: `apps/web/src/components/ui/toast.tsx`
- Create: `apps/web/src/components/ui/feedback.tsx`
- Modify: `apps/web/src/components/ui/setting-row.tsx`
- Modify: `apps/web/src/components/ui/Logo.tsx`
- Create: `apps/web/src/components/ui/__tests__/selection-controls.test.tsx`
- Create: `apps/web/src/components/ui/__tests__/feedback.test.tsx`

**Interfaces:**
- Consumes: Radix Switch, Radix Tabs, `Button`, `IconButton`, `Badge`, `Surface`, and semantic tokens.
- Produces: existing `Switch`, `SegmentedTabs<T>`, `Badge`, `CopyButton`, `Toast`, `SettingRow`, `SettingSection`, `GraphMindIcon`, and `LogoBadge`; new `InlineFeedback` and `EmptyState`.
- `InlineFeedbackProps`: `{ tone: "info" | "success" | "warning" | "destructive"; title?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }`.
- `EmptyStateProps`: `{ icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode; className?: string }`.

- [ ] **Step 1: Write failing interaction and announcement tests**

Cover these exact behaviors:

```tsx
it("toggles the controlled switch with Space", async () => {
  const user = userEvent.setup();
  const onCheckedChange = vi.fn();
  render(<Switch checked={false} onCheckedChange={onCheckedChange} id="auto-scroll" />);
  const control = screen.getByRole("switch");
  control.focus();
  await user.keyboard(" ");
  expect(onCheckedChange).toHaveBeenCalledWith(true);
});

it("exposes segmented choices as tabs", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<SegmentedTabs value="chat" onChange={onChange} items={[{ id: "chat", label: "Chat" }, { id: "canvas", label: "Canvas" }]} />);
  expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "true");
  await user.click(screen.getByRole("tab", { name: "Canvas" }));
  expect(onChange).toHaveBeenCalledWith("canvas");
});

it("announces request errors and provides a labeled dismiss action", () => {
  render(<Toast message="Connection failed" onDismiss={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Connection failed");
  expect(screen.getByRole("button", { name: "Dismiss error" })).toBeVisible();
});
```

Add the following cases:

```tsx
it("changes CopyButton's accessible label after writing to the clipboard", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  render(<CopyButton text="Raft notes" title="Copy notes" copiedTitle="Notes copied" />);
  await user.click(screen.getByRole("button", { name: "Copy notes" }));
  expect(writeText).toHaveBeenCalledWith("Raft notes");
  expect(screen.getByRole("button", { name: "Notes copied" })).toBeVisible();
});

it("maps warning badges to semantic status tokens", () => {
  render(<Badge variant="warning">Needs review</Badge>);
  expect(screen.getByText("Needs review")).toHaveClass("bg-warning-bg", "text-warning");
});

it("renders an EmptyState heading and supplied action", () => {
  render(<EmptyState title="No sources yet" description="Attach a document to begin." action={<Button>Attach document</Button>} />);
  expect(screen.getByRole("heading", { name: "No sources yet" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Attach document" })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/selection-controls.test.tsx src/components/ui/__tests__/feedback.test.tsx
```

Expected: FAIL because the current controls do not expose the complete contracts and feedback uses raw hardcoded styles.

- [ ] **Step 3: Implement controlled Radix selection primitives**

Implement `Switch` with `SwitchPrimitive.Root` and `SwitchPrimitive.Thumb`, preserving `checked`, `onCheckedChange`, `disabled`, `id`, and `className`. Use `bg-primary` for checked, `bg-muted` for unchecked, `bg-surface-raised` for the thumb, and `focus-visible:ring-focus-ring`.

Implement `SegmentedTabs<T>` with `TabsPrimitive.Root`, `List`, and one `Trigger` per item. Keep `onValueChange={(next) => onChange(next as T)}`. Use standard padding and typography. Render item badges through `Badge`, not a bespoke span recipe.

- [ ] **Step 4: Normalize status and feedback composition**

- Map Badge status variants only to `success`, `success-bg`, `warning`, `warning-bg`, `destructive`, `destructive-bg`, `info`, and `info-bg`; remove palette-specific classes and the `purple` variant.
- Rebuild CopyButton with `IconButton`, preserving its public props and two-second copied state. Set the successful icon to `text-success` and expose the changed label through `aria-label`.
- Rebuild Toast with `role="alert"`, semantic destructive tokens, `IconButton label="Dismiss error"`, and `z-toast`.
- Implement `InlineFeedback` and `EmptyState` using `Surface`; action slots render only when a real callback/control is supplied.
- Replace SettingRow's handcrafted badge with `Badge variant="warning"` and SettingSection's surface recipe with `Surface`.
- Replace `Logo.tsx` hardcoded neutral classes with `bg-primary text-primary-foreground` for the brand badge and `text-current` for the glyph.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/selection-controls.test.tsx src/components/ui/__tests__/feedback.test.tsx
pnpm --filter @graphmind/web typecheck
git add apps/web/src/components/ui/switch.tsx apps/web/src/components/ui/segmented-tabs.tsx apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/copy-button.tsx apps/web/src/components/ui/toast.tsx apps/web/src/components/ui/feedback.tsx apps/web/src/components/ui/setting-row.tsx apps/web/src/components/ui/Logo.tsx apps/web/src/components/ui/__tests__/selection-controls.test.tsx apps/web/src/components/ui/__tests__/feedback.test.tsx
git diff --cached --check
git commit -m "refactor(web): unify selection and feedback primitives"
```

### Task 7: Enforce the primitive contract and complete Task 1 verification

**Files:**
- Create: `apps/web/src/components/ui/__tests__/design-contract.test.ts`
- Create: `apps/web/src/components/ui/README.md`

**Interfaces:**
- Consumes: all Task 1-6 primitive files.
- Produces: a CI-enforced source contract for the generic UI directory and usage documentation for later migrations.

- [ ] **Step 1: Write the contract test**

Create `design-contract.test.ts`:

```ts
// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const uiDir = path.resolve(process.cwd(), "src/components/ui");
const files = readdirSync(uiDir).filter((name) => name.endsWith(".tsx"));
const forbiddenPalette = /\b(?:bg|text|border|ring|stroke|fill)-(?:white|black|zinc|slate|gray|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-/;
const forbiddenType = /text-\[(?:[^\]]+)\]/;
const forbiddenSpacing = /\b(?:h|w|p[trblxy]?|m[trblxy]?)-(?:4\.5|7\.5|8\.5|9\.5)\b/;
const forbiddenLiteralColor = /#[0-9a-f]{3,8}\b|rgba?\(/i;

describe("components/ui design contract", () => {
  it.each(files)("keeps %s on semantic colors and standard scales", (name) => {
    const source = readFileSync(path.join(uiDir, name), "utf8");
    expect(source).not.toMatch(forbiddenPalette);
    expect(source).not.toMatch(forbiddenType);
    expect(source).not.toMatch(forbiddenSpacing);
    expect(source).not.toMatch(forbiddenLiteralColor);
  });
});
```

- [ ] **Step 2: Run the contract test and correct every reported primitive**

```bash
pnpm --filter @graphmind/web test -- src/components/ui/__tests__/design-contract.test.ts
```

Expected before cleanup: FAIL with the exact remaining file and forbidden class. Replace each reported class with an existing semantic token or repository-approved scale value. The forbidden spacing list targets values already identified in this codebase as outside the approved component dimensions; valid Tailwind half-step icon sizes such as `size-3.5` remain allowed. Do not weaken the regular expressions to make failures disappear.

- [ ] **Step 3: Document the selection rules**

Create `apps/web/src/components/ui/README.md` with:

```md
# GraphMind UI primitives

Product code composes these primitives and must not recreate their visual or accessibility contracts.

- Use `Button` for labeled actions and `IconButton` for icon-only actions.
- Every `IconButton` requires `label`; add `tooltip` when the action is not already explained nearby.
- Use `Input` for one line and `Textarea` for multiline text.
- Use `Surface` for bordered/elevated containers.
- Use `DropdownMenu`, `Modal`, `Drawer`, and `ConfirmDialog` for compound overlays.
- Use `InlineFeedback`, `EmptyState`, `Skeleton`, and `Toast` for explicit states.
- Use semantic tokens only. Literal palette classes and arbitrary typography or half-step spacing are rejected by `design-contract.test.ts`.
- Product-specific patterns belong outside this directory.
```

- [ ] **Step 4: Run the complete frontend verification suite**

```bash
pnpm --filter @graphmind/web test
pnpm --filter @graphmind/web typecheck
pnpm --filter @graphmind/web lint
pnpm --filter @graphmind/web build
```

Expected: all tests pass; typecheck, lint, and production build exit 0.

- [ ] **Step 5: Perform the manual primitive matrix**

Run `pnpm --filter @graphmind/web dev` and verify the existing screens that consume primitives at these viewport widths:

- 1440px desktop;
- 768px tablet;
- 390px mobile.

For each width, verify light and dark themes and record results in the commit body for:

- Button default, hover, focus, disabled, and loading;
- Input and Textarea focus, disabled, and error;
- Dropdown keyboard open, arrow navigation, selection, Escape, and focus restoration;
- Modal, Drawer, and ConfirmDialog focus containment and dismissal;
- Switch and SegmentedTabs keyboard interaction;
- Toast and InlineFeedback announcements;
- reduced-motion behavior with the browser preference enabled or by emulating `prefers-reduced-motion: reduce` in browser developer tools.

- [ ] **Step 6: Commit the enforcement and documentation**

```bash
git add apps/web/src/components/ui/__tests__/design-contract.test.ts apps/web/src/components/ui/README.md
git diff --cached --check
git commit -m "test(web): enforce UI primitive design contract"
```

- [ ] **Step 7: Confirm the worktree boundary**

```bash
git status --short
git log -7 --oneline
```

Expected: the seven Task 1 commits are present. Pre-existing user changes, including `WorkspaceDashboard.tsx`, remain outside the Task 1 commits unless the user explicitly authorized otherwise. No chat, canvas, routing, API, or persistence file was modified by this plan.

---

## Task 1 Completion Gate

Task 1 is complete only when all seven implementation units pass review, all automated commands exit 0, the manual matrix is recorded, and the staged/committed diffs contain only foundations, generic primitives, their tests, test configuration, dependency metadata, and primitive documentation. Completion authorizes a separate design-confirmation cycle for Task 2, the canonical chat experience; it does not authorize beginning Task 2 automatically.
