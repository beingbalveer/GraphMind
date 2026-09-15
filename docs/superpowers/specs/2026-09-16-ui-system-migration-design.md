# UI System Migration Design

## Goal

Make every GraphMind interface use one coherent, production-ready component system based on the official source-distributed Design components and Base UI primitives.

## Decisions

- Keep GraphMind's routes, data flow, workspace layout, navigation, and AI features unchanged.
- Replace legacy Radix-backed and bespoke visual primitives behind `components/ui/` first; app surfaces consume only those shared primitives.
- Use the official component source as the visual authority. Local wrappers may preserve required GraphMind behavior such as loading, errors, and routing, but do not introduce a second visual language.
- Migrate by primitive family, then every consuming surface. This avoids page-by-page styling drift.
- Treat dialogs, drawers, menus, toasts, empty/loading/error states, keyboard focus, and dark mode as first-class UI states.

## Scope

1. Foundation: tokens and global primitive source for Button, Input, Textarea, Select, Switch, Badge, Tabs, Menu, Dialog, Drawer, Tooltip, Toast, Skeleton, and feedback.
2. Workspace shell: navigation, header, sidebars, user menu, workspace dashboard and selector.
3. Chat: composer, messages, branches, auxiliary panels, viewer overlays, flashcards, learning signals.
4. Canvas and library: canvas chrome, node controls, focus surfaces, command palette, file management and viewers.
5. Verification: no raw interactive elements in app surfaces; keyboard behavior, responsive layouts, dark mode, typecheck, tests, build, and browser walkthroughs.

## Constraints

- No references to the upstream product name in application source.
- No custom color palettes in surface components; use semantic tokens.
- No raw button, input, textarea, dialog, menu, or drawer implementations in app surfaces.
- Every migrated component preserves current behavior and accessibility names.
